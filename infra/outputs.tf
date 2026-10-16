output "primary_region" {
  value       = var.primary_region
  description = "Primary region where pipeline is deployed"
}

output "target_regions" {
  value       = var.target_regions
  description = "List of target regions for layer distribution"
}

output "primary_obs_bucket" {
  value       = huaweicloud_obs_bucket.primary_layer_bucket.bucket
  description = "Name of the primary OBS bucket for build artifacts"
}

output "regional_obs_buckets" {
  value = { for k, v in huaweicloud_obs_bucket.regional_layer_buckets : k => v.bucket }
  description = "Map of regional OBS buckets"
}

output "vpc_id" {
  value       = huaweicloud_vpc.functiongraph_vpc.id
  description = "ID of the VPC for FunctionGraph"
}

output "subnet_id" {
  value       = huaweicloud_vpc_subnet.functiongraph_subnet.id
  description = "ID of the subnet for FunctionGraph"
}
