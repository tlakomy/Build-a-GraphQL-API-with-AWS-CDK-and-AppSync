import * as cdk from "@aws-cdk/core";
import * as appsync from "@aws-cdk/aws-appsync";

export class AppsyncCdkCoursePlanStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new appsync.GraphqlApi(this, "Api", {
      name: "my-api",
      schema: appsync.Schema.fromAsset("graphql/schema.graphql"),
    });
  }
}
