variable "primary_region" {
  type        = string
  description = "Primary region for pipeline deployment"
  default     = "cn-north-4"
}

variable "target_regions" {
  type        = list(string)
  description = "List of target regions for layer distribution"
  default     = ["cn-north-4", "cn-east-1", "cn-south-1"]
}

variable "layer_name" {
  type        = string
  description = "Name of the FunctionGraph layer"
  default     = "sample-layer"
}

variable "layer_description" {
  type        = string
  description = "Description of the layer"
  default     = "Sample layer distributed to multiple regions"
}

variable "layer_runtimes" {
  type        = list(string)
  description = "Compatible runtimes for the layer"
  default     = ["Node.js 18.x", "Node.js 20.x"]
}

variable "codehub_repository_name" {
  type        = string
  description = "Name of the CodeHub repository"
  default     = "functiongraph-layer-source"
}

variable "build_timeout" {
  type        = number
  description = "CloudBuild timeout in minutes"
  default     = 10
}
