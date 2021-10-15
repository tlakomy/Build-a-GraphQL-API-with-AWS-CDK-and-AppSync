import * as cdk from "@aws-cdk/core";
import * as appsync from "@aws-cdk/aws-appsync";
import * as lambda from "@aws-cdk/aws-lambda";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export class AppsyncCdkCoursePlanStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const booksTable = new dynamodb.Table(this, "BooksTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const api = new appsync.GraphqlApi(this, "Api", {
      name: "my-api",
      schema: appsync.Schema.fromAsset("graphql/schema.graphql"),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            description: "An API key for my revolutionary bookstore app",
            name: "My API Key",
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
    });

    const listBooksLambda = new lambda.Function(this, "listBooksHandler", {
      handler: "listBooks.handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("functions"),
      environment: {
        BOOKS_TABLE: booksTable.tableName,
      },
    });

    booksTable.grantReadData(listBooksLambda);

    const listBookDataSource = api.addLambdaDataSource(
      "listBookDataSource",
      listBooksLambda,
    );

    listBookDataSource.createResolver({
      typeName: "Query",
      fieldName: "listBooks",
    });

    const createBookLambda = new lambda.Function(this, "createBookHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "createBook.handler",
      code: lambda.Code.fromAsset("functions"),
      memorySize: 1024,
      environment: {
        BOOKS_TABLE: booksTable.tableName,
      },
    });

    booksTable.grantReadWriteData(createBookLambda);

    const createBookDataSource = api.addLambdaDataSource(
      "createBookDataSource",
      createBookLambda,
    );

    createBookDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "createBook",
    });

    new cdk.CfnOutput(this, "GraphQLAPIURL", {
      value: api.graphqlUrl,
    });

    new cdk.CfnOutput(this, "GraphQLAPIKey", {
      value: api.apiKey || "",
    });
  }
}
