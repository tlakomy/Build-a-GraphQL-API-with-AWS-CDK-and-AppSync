import * as cdk from "@aws-cdk/core";
import * as appsync from "@aws-cdk/aws-appsync";
import * as lambda from "@aws-cdk/aws-lambda";
import * as nodeJsLambda from "@aws-cdk/aws-lambda-nodejs";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as path from "path";

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

    const commonLambdaProps: Omit<lambda.FunctionProps, "handler"> = {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("functions"),
      memorySize: 1024,
      architectures: [lambda.Architecture.ARM_64],
      timeout: cdk.Duration.seconds(10),
      environment: {
        BOOKS_TABLE: booksTable.tableName,
      },
    };

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
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      xrayEnabled: true,
    });

    const listBooksLambda = new lambda.Function(this, "listBooksHandler", {
      handler: "listBooks.handler",
      ...commonLambdaProps,
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

    const getBookByIdLambda = new lambda.Function(this, "getBookById", {
      handler: "getBookById.handler",
      ...commonLambdaProps,
    });

    booksTable.grantReadData(getBookByIdLambda);

    const getBookByIdDataSource = api.addLambdaDataSource(
      "getBookByIdDataSource",
      getBookByIdLambda,
    );

    getBookByIdDataSource.createResolver({
      typeName: "Query",
      fieldName: "getBookById",
    });

    const createBookLambda = new lambda.Function(this, "createBookHandler", {
      handler: "createBook.handler",
      ...commonLambdaProps,
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

    const updateBookLambda = new nodeJsLambda.NodejsFunction(
      this,
      "updateBookHandler",
      {
        ...commonLambdaProps,
        entry: path.join(__dirname, "../functions/updateBook.ts"),
      },
    );

    booksTable.grantReadWriteData(updateBookLambda);

    const updateBookDataSource = api.addLambdaDataSource(
      "updateBookDataSource",
      updateBookLambda,
    );

    updateBookDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "updateBook",
    });

    new cdk.CfnOutput(this, "GraphQLAPIURL", {
      value: api.graphqlUrl,
    });

    new cdk.CfnOutput(this, "GraphQLAPIKey", {
      value: api.apiKey || "",
    });
  }
}
