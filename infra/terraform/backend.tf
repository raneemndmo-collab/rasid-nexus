##############################################################
# RASID NEXUS — Remote State Backend Configuration
# S3 + DynamoDB Locking + KMS Encryption
##############################################################
# PREREQUISITE: Run backend-bootstrap/ first to create the
# S3 bucket, DynamoDB table, and KMS key.
# Then update the values below with the bootstrap outputs.
##############################################################

terraform {
  backend "s3" {
    bucket         = "rasid-nexus-production-tfstate"
    key            = "rasid-nexus/eu-0a-001/terraform.tfstate"
    region         = "me-south-1"
    dynamodb_table = "rasid-nexus-production-tflock"
    encrypt        = true
    # kms_key_id   = "<KMS_KEY_ARN_FROM_BOOTSTRAP_OUTPUT>"
  }
}
