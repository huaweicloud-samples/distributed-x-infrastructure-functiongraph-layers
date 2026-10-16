/**
 * Layer Distributor Function
 * 
 * Huawei Cloud FunctionGraph function that distributes layer.zip to multiple regions.
 * 
 * Flow:
 * 1. Download layer.zip from primary OBS bucket
 * 2. Upload to regional OBS bucket
 * 3. Register layer version with FunctionGraph in target region
 * 4. Report success/failure to CodeArts Pipeline
 */

const ObsClient = require('esdk-obs-nodejs');
const { FunctionGraphClient, PublishLayerVersionRequest, AddLayerVersionPermissionRequest } = require('@huaweicloud/huaweicloud-sdk-functiongraph');
const HuaweiCloudSDK = require('@huaweicloud/huaweicloud-sdk-core');

/**
 * Initialize OBS client
 * @param {string} region - OBS region endpoint
 * @param {string} accessKey - HW Access Key
 * @param {string} secretKey - HW Secret Key
 * @returns {ObsClient}
 */
function createObsClient(region, accessKey, secretKey) {
  return new ObsClient({
    access_key_id: accessKey,
    secret_access_key: secretKey,
    server: `https://obs.${region}.myhuaweicloud.com`,
    timeout: 60
  });
}

/**
 * Download file from OBS
 * @param {ObsClient} obsClient
 * @param {string} bucket
 * @param {string} key
 * @returns {Promise<Buffer>}
 */
async function downloadFromObs(obsClient, bucket, key) {
  return new Promise((resolve, reject) => {
    obsClient.getObject({
      Bucket: bucket,
      Key: key
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        // Result is a Buffer
        resolve(result.content);
      }
    });
  });
}

/**
 * Upload file to OBS
 * @param {ObsClient} obsClient
 * @param {string} bucket
 * @param {string} key
 * @param {Buffer|string} content
 * @returns {Promise<void>}
 */
async function uploadToObs(obsClient, bucket, key, content) {
  return new Promise((resolve, reject) => {
    obsClient.putObject({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentLength: content.length
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Publish layer version to FunctionGraph
 * @param {string} region - Target region
 * @param {string} layerName - Layer name
 * @param {string} layerDescription - Layer description
 * @param {string} obsBucket - OBS bucket name containing layer.zip
 * @param {string} obsKey - OBS object key for layer.zip
 * @param {string} accessKey - HW Access Key
 * @param {string} secretKey - HW Secret Key
 * @returns {Promise<object>} - Layer version info
 */
async function publishLayerVersion(region, layerName, layerDescription, obsBucket, obsKey, accessKey, secretKey) {
  const credentials = HuaweiCloudSDK.Credentials.fromAccessKey(region, accessKey, secretKey);
  
  const client = FunctionGraphClient.newBuilder()
    .withCredential(credentials)
    .withRegion(region)
    .build();

  // Create publish layer version request
  const request = new PublishLayerVersionRequest();
  request.layerName = layerName;
  request.description = layerDescription;
  request.runtime = 'Node.js 18.x';
  request.obsBucket = obsBucket;
  request.obsKey = obsKey;
  
  // For actual implementation, use the SDK's async method
  return new Promise((resolve, reject) => {
    client.publishLayerVersion(request, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Report success to CodeArts Pipeline
 * @param {string} jobId - CodeArts Pipeline job ID
 */
async function reportPipelineSuccess(jobId) {
  console.log(`Pipeline job ${jobId} completed successfully`);
  // In production, call CodeArts Pipeline API to report success
}

/**
 * Report failure to CodeArts Pipeline
 * @param {string} jobId - CodeArts Pipeline job ID
 * @param {string} message - Failure message
 */
async function reportPipelineFailure(jobId, message) {
  console.error(`Pipeline job ${jobId} failed: ${message}`);
  // In production, call CodeArts Pipeline API to report failure
}

/**
 * Main handler function
 * @param {object} event - FunctionGraph event
 * @param {object} context - FunctionGraph context
 * @returns {Promise<object>}
 */
exports.handler = async (event, context) => {
  const logger = context.getLogger();
  
  // Extract credentials from environment (set via IAM agency)
  const accessKey = process.env.HW_ACCESS_KEY || context.getAccessKey();
  const secretKey = process.env.HW_SECRET_KEY || context.getSecretKey();
  
  // Parse input parameters
  let inputParams;
  try {
    inputParams = typeof event === 'string' ? JSON.parse(event) : event;
  } catch (e) {
    // event may already be an object
    inputParams = event;
  }
  
  const {
    region,
    layerName = 'sample-layer',
    layerDescription = 'Sample layer distributed to multiple regions',
    obsBucketPrimary,
    jobId
  } = inputParams;
  
  logger.info(`Starting layer distribution to region: ${region}`);
  logger.info(`Layer name: ${layerName}`);
  logger.info(`Primary OBS bucket: ${obsBucketPrimary}`);
  
  const primaryRegion = process.env.PRIMARY_REGION || 'cn-north-4';
  
  try {
    // Step 1: Download layer.zip from primary OBS
    logger.info('Step 1: Downloading layer.zip from primary OBS...');
    const primaryObsClient = createObsClient(primaryRegion, accessKey, secretKey);
    const layerZip = await downloadFromObs(primaryObsClient, obsBucketPrimary, 'layer.zip');
    logger.info(`Downloaded layer.zip (${layerZip.length} bytes)`);
    
    // Step 2: Upload to regional OBS bucket
    logger.info(`Step 2: Uploading layer.zip to regional OBS bucket (${region})...`);
    const regionalObsClient = createObsClient(region, accessKey, secretKey);
    const regionalBucketName = `layer-artifacts-${region}`;
    await uploadToObs(regionalObsClient, regionalBucketName, 'layer.zip', layerZip);
    logger.info(`Uploaded layer.zip to obs://${regionalBucketName}/layer.zip`);
    
    // Step 3: Register layer version with FunctionGraph
    logger.info(`Step 3: Registering layer version in region ${region}...`);
    const layerResult = await publishLayerVersion(
      region,
      layerName,
      layerDescription,
      regionalBucketName,
      'layer.zip',
      accessKey,
      secretKey
    );
    logger.info(`Layer version published: ${JSON.stringify(layerResult)}`);
    
    // Step 4: Report success to pipeline
    if (jobId) {
      await reportPipelineSuccess(jobId);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        region: region,
        layerVersion: layerResult,
        message: `Layer ${layerName} distributed successfully to ${region}`
      })
    };
    
  } catch (error) {
    logger.error(`Error distributing layer to ${region}: ${error.message}`);
    logger.error(error.stack);
    
    if (jobId) {
      await reportPipelineFailure(jobId, error.message);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        region: region,
        error: error.message,
        message: `Failed to distribute layer to ${region}`
      })
    };
  }
};
