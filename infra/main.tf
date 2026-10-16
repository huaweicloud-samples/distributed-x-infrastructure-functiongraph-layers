terraform {
  required_version = ">= 1.5.0"
  required_providers {
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = "= 1.96.1"
    }
  }
}

provider "huaweicloud" {
  region     = var.primary_region
  access_key = "YOUR_ACCESS_KEY"
  secret_key = "YOUR_SECRET_KEY"
}

# =====================
# Data Sources
# =====================

data "huaweicloud_availability_zones" "available" {}

# =====================
# VPC Network
# =====================

resource "huaweicloud_vpc" "functiongraph_vpc" {
  name = "layer-distribution-vpc"
  cidr = "10.0.0.0/16"
}

resource "huaweicloud_vpc_subnet" "functiongraph_subnet" {
  vpc_id      = huaweicloud_vpc.functiongraph_vpc.id
  name        = "layer-distribution-subnet"
  cidr        = "10.0.1.0/24"
  gateway_ip  = "10.0.1.1"
  description = "Subnet for FunctionGraph layer distribution pipeline"
}

# =====================
# OBS Buckets
# =====================

# Primary OBS bucket (build artifact storage)
resource "huaweicloud_obs_bucket" "primary_layer_bucket" {
  bucket        = "layer-artifacts-${replace(var.primary_region, "-", "")}-${data.huaweicloud_availability_zones.available.names[0]}"
  acl           = "private"
  storage_class = "STANDARD"

  tags = {
    ManagedBy = "Terraform"
    Project   = "multi-region-layers"
  }
}

# Regional OBS buckets (one per target region for layer distribution)
resource "huaweicloud_obs_bucket" "regional_layer_buckets" {
  for_each = toset(var.target_regions)

  bucket        = "layer-artifacts-${replace(each.value, "-", "")}"
  acl           = "public-read"
  storage_class = "STANDARD"

  tags = {
    ManagedBy = "Terraform"
    Project   = "multi-region-layers"
    Region    = each.value
  }
}
