import * as cdk from "@aws-cdk/core";

export class AppsyncCdkCoursePlanStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hello: string = "world";
  }
}
