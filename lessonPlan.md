# Build a GraphQL API with AWS CDK and AppSync

## Lesson 1.

**Create an AWS CDK stack from scratch**

Description:
_Before we start working on our GraphQL API, we need to create a project first. In this lesson, we're going to learn how to create a brand new CDK project from scratch._

Link to Configuring AWS CLI page: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html

Steps:

- `npm install aws-cdk`
- `cdk --version`
- `aws s3 ls`
- `aws sts get-caller-identity` ("You shouldn't share your account number")
- `mkdir my-graphql-api`
- `cdk init app --language=typescript`

## Lesson 2.

**Deploy a CDK stack to AWS**

Description:
_Even though our stack is empty, we should deploy it to AWS to verify that everything is set up properly. In this lesson, we're going to learn how to use `cdk deploy` command in order to ship our brand new stack to AWS._

Steps:

- `npm run watch`
- Show that it's generating JS files (`const hello: string = "world";`)
- `cdk bootstrap` (mention that it's necessary only for new regions/accounts)
- `cdk deploy`
- Go to CloudFormation, verify that the stack is there
- Take a look at CloudFormation template

## Lesson 3

**Create an AppSync GraphQL API**

Description: _It's time to start learning AppSync & GraphQL. In this lesson, we're going to create a simple schema for a bookstore website and create a GraphQL API using AppSync._

Steps:

- Create a schema

`graphql/schema.graphql`

```graphql
type Book {
  id: ID!
  name: String!
  completed: Boolean
  rating: Int
  reviews: [String]
}

type Query {
  listBooks: [Book]
}
```

- `npm install @aws-cdk/aws-appsync`
- Create an AppSync-powered GraphQL API:

```ts
const api = new appsync.GraphqlApi(this, "Api", {
  name: "my-api",
  schema: appsync.Schema.fromAsset("graphql/schema.graphql"),
});
```

- Go to AWS Console, verify that the API is there in CloudFormation/AppSync console
- Open GraphQL playground, send a request, it'll fail due to lack of auth headers
- Specify the `x-api-key` header and copy the value from the Console

## Lesson 4

**Add an API key to an AppSync API**

Description: _All AppSync-powered APIs need to have some sort of authentication (otherwise there'd be a risk of DDoS attack, which might be costly). In this lesson, we're going to learn how to add a non-default API key authorization to our AppSync API._

Steps:

- Add an authorization config to our API:

```ts
authorizationConfig: {
  defaultAuthorization: {
    authorizationType: appsync.AuthorizationType.API_KEY,
    apiKeyConfig: {
      description: "An API key for my revolutionary bookstore app",
      name: "My API Key",
      expires: cdk.Expiration.after(cdk.Duration.days(365)), // Mention that by default it's 7 days
    },
  },
},
```

- To make our life easier, let's add two CloudFormation outputs:

```ts
new cdk.CfnOutput(this, "GraphQLAPIURL", {
  value: api.graphqlUrl,
});

new cdk.CfnOutput(this, "GraphQLAPIKey", {
  value: api.apiKey || "",
});
```

- Call `listBooks` query with our brand new API key:

```graphql
query ListBooks {
  listBooks {
    id
    name
  }
}
```

## Lesson 5

**Add a Lambda data source to an AppSync API**

Description:

_It's time to start writing business logic. In this lesson we're going to learn how to create an AWS Lambda data source and connect it to a GraphQL API powered by AppSync._

Steps:

- `npm install @aws-cdk/aws-lambda`

```ts
const listBooksLambda = new lambda.Function(this, "listBooksHandler", {
  handler: "listBooks.handler",
  runtime: lambda.Runtime.NODEJS_14_X,
  code: lambda.Code.fromAsset("functions"),
});
```

- Create a `functions/listBooks.ts` file with the following content:

```ts
export const handler = async () => {
  return [
    {
      id: "abc-123",
      title: "My Awesome Book",
      completed: true,
      rating: 10,
      reviews: ["The best book ever written"],
    },
    {
      id: "def-456",
      title: "A Terrible Book",
      completed: true,
      rating: 2,
      reviews: ["What did I just read?!"],
    },
  ];
};
```

- Next add a lambda data source and create a GraphQL resolver:

```ts
const listBookDataSource = api.addLambdaDataSource(
  "listBookDataSource",
  listBooksLambda,
);

listBookDataSource.createResolver({
  typeName: "Query",
  fieldName: "listBooks",
});
```

- Run `cdk diff` to understand what is about to be deployed
- Deploy & verify that a resolver has been attached
- Test the API

## Lesson 6

**Create a DynamoDB table to store books**

Description: _Our API definitely shouldn't rely on hardcoded data. In this lesson, we're going to learn how to create a DynamoDB table, and allow a Lambda function to access its data._

Steps:

- `npm install @aws-cdk/aws-dynamodb`
- Add a books table:

```ts
const booksTable = new dynamodb.Table(this, "BooksTable", {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  partitionKey: {
    name: "id",
    type: dynamodb.AttributeType.STRING,
  },
});
```

- Add environment variable to a Lambda function:

```ts
environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
```

- Grant read data:

```ts
booksTable.grantReadData(listBooksLambda);
```

^ Mention the principle of least priviledge

- Deploy the stack and verify that the table was successfully created

## Lesson 7

**Read data from a DynamoDB table in a Lambda resolver**

Description: _It's time to wire things together. In this lesson, we're going to learn how to use DynamoDB DocumentClient in order to read data from a table in `listBooks` function. In addition to that we'll learn how to use `@types/aws-lambda` package._

Steps:

- `npm install @types/aws-lambda` & `npm install aws-sdk`
- `import { AppSyncResolverHandler } from "aws-lambda";`
- Use it like this: `export const handler: AppSyncResolverHandler<null, Book[] | null> =`
- Create the Book type:

```ts
type Book = {
  id: string;
  title: string;
  completed?: boolean;
  rating?: number;
  reviews?: string[];
};
```

- Implement the function:

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { DynamoDB } from "aws-sdk";

type Book = {
  id: string;
  title: string;
  completed?: boolean;
  rating?: number;
  reviews?: string[];
};

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<null, Book[] | null> =
  async () => {
    try {
      if (!process.env.BOOKS_TABLE) {
        console.log("BOOKS_TABLE was not specified");
        return null;
      }

      const data = await docClient
        .scan({ TableName: process.env.BOOKS_TABLE })
        .promise();

      return data.Items as Book[];
    } catch (err) {
      console.error("[Error] DynamoDB error: ", err);
      return null;
    }
  };
```

- Deploy and call the API, an empty list of books should be returned
- Go to DynamoDB console and add two books by hand

```json
{
  "data": {
    "listBooks": [
      {
        "id": "456",
        "title": "A Philosophy of Software Design",
        "completed": true,
        "rating": 11,
        "reviews": [
          "A must-read for every developer",
          "The best book on software design ever written"
        ]
      },
      {
        "id": "123",
        "title": "Atomic Habits",
        "completed": true,
        "rating": 10,
        "reviews": ["10/10, changed my life!", "Fantastic book"]
      }
    ]
  }
}
```

- Call the API again, list all books

## Lesson 8

**Generate TypeScript types from a GraphQL schema**

Description: _Creating TypeScript types from a GraphQL schema by hand is prone to errors - what if we forgot to update the types after changing the schema? In this lesson, we're going to learn how to autogenerate TypeScript types from a schema and use them in a Lambda function._

Note: let's make sure to include the link to this excellent blogpost: https://benoitboure.com/how-to-use-typescript-with-appsync-lambda-resolvers

Steps:

- `npm install @graphql-codegen/cli @graphql-codegen/typescript`
- Create a `codegen.yml` file:

```yaml
overwrite: true
schema:
  - graphql/schema.graphql

generates:
  types/books.d.ts:
    plugins:
      - typescript
```

- Create `appsync.graphql` file with the following content, mention that those are scalars that are built-in in AppSync:

```yaml
scalar AWSDate
scalar AWSTime
scalar AWSDateTime
scalar AWSTimestamp
scalar AWSEmail
scalar AWSJSON
scalar AWSURL
scalar AWSPhone
scalar AWSIPAddress
```

- Modify `codegen.yml`:

```
overwrite: true
schema:
  - graphql/schema.graphql
  - graphql/appsync.graphql

config:
  scalars:
    AWSJSON: string
    AWSDate: string
    AWSTime: string
    AWSDateTime: string
    AWSTimestamp: number
    AWSEmail: string
    AWSURL: string
    AWSPhone: string
    AWSIPAddress: string

generates:
  types/books.d.ts:
    plugins:
      - typescript
```

- Add a `"codegen": "graphql-codegen"` command to `package.json`
- Run `npm run codegen` and check the contents of `types/books.d.ts`
- Replace types in `listBooks` lambda with autogenerated ones
- Deploy and verify that the behaviour is unchanged

## Lesson 9

**Add a GraphQL mutation to create a book**

Description: _Our API should allow users to add books to their list. In this lesson we're going to learn how to create a GraphQL mutation with AppSync by using `putItem` method in DynamoDB._

Steps:

- Update the GraphQL schema to include a mutation:

```
type Mutation {
  createBook(book: BookInput!): Book
}
```

- Add a `BookInput`:

(We cannot create a book with reviews, ratings and completed flag by default)

```graphql
input BookInput {
  id: ID!
  title: String!
}
```

- Create a new Lambda function:

```ts
const createBookLambda = new lambda.Function(this, "createBookHandler", {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: "createBook.handler",
  code: lambda.Code.fromAsset("functions"),
  memorySize: 1024,
  timeout: Duration.seconds(10),
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
});

booksTable.grantReadWriteData(createBookLambda);
```

- Add a new Lambda data source:

```ts
const createBookDataSource = api.addLambdaDataSource(
  "createBookDataSource",
  createBookLambda,
);

createBookDataSource.createResolver({
  typeName: "Mutation",
  fieldName: "createBook",
});
```

- Create a new Lambda function:
  `functions/createBook.ts`

- Regenerate the types to create a `MutationCreateBookArgs`

- Before we implement a mutation, let's talk about the `events` object

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { Book, MutationCreateBookArgs } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  MutationCreateBookArgs,
  Book | null
> = async (event) => {
  console.log("event", event);

  return null;
};
```

- Deploy the function
- Run a mutation
- Go to Lambda logs and point the learner to `arguments`
- Implement the rest of the function:

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { Book, MutationCreateBookArgs } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  MutationCreateBookArgs,
  Book | null
> = async (event) => {
  const book = event.arguments.book;

  try {
    if (!process.env.BOOKS_TABLE) {
      console.log("BOOKS_TABLE was not specified");
      return null;
    }

    await docClient
      .put({ TableName: process.env.BOOKS_TABLE, Item: book })
      .promise();

    return book;
  } catch (err) {
    console.error("[Error] DynamoDB error: ", err);
    return null;
  }
};
```

## Lesson 10

**Investigate and fix Lambda function latency**

Description: _In this quick lesson we're going to learn how to measure the time it takes to execute a Lambda resolver. In addition to that we'll learn how to increase Lambda function memory in order to improve its performance._

Steps:

- Show a cold start/regular execution of `createBook` function and how it's taking a bit long
- Increase `memorySize` to 1024
- Deploy, test

## Lesson 11

**Query a book by its ID with AppSync**

Description: _Apart from getting all of our books, we'd like to be able to query a single book by its ID. In this lesson we're going to learn how to implement a `getBookById` and attach it to our GraphQL API._

Steps:

- Add a `getBookById` query to schema

```graphql
type Query {
  listBooks: [Book]
  getBookById(bookId: ID!): Book
}
```

- Regenerate types
- Add a Lambda function to stack and grant it ability to read data from DDB

```ts
const getBookByIdLambda = new lambda.Function(this, "getBookById", {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: "getBookById.handler",
  code: lambda.Code.fromAsset("functions"),
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
});

booksTable.grantReadData(getBookByIdLambda);
```

- Create a Lambda data source:

```ts
const getBookByIdDataSource = api.addLambdaDataSource(
  "getBookByIdDataSource",
  getBookByIdLambda,
);

getBookByIdDataSource.createResolver({
  typeName: "Query",
  fieldName: "getBookById",
});
```

- Implement a function (note the `QueryGetBookByIdArgs` type):

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { Book, QueryGetBookByIdArgs } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  QueryGetBookByIdArgs,
  Book | null
> = async (event) => {
  try {
    if (!process.env.BOOKS_TABLE) {
      console.log("BOOKS_TABLE was not specified");
      return null;
    }

    const { Item } = await docClient
      .get({
        TableName: process.env.BOOKS_TABLE,
        Key: { id: event.arguments.bookId },
      })
      .promise();

    return Item as Book;
  } catch (err) {
    console.error("[Error] DynamoDB error: ", err);
    return null;
  }
};
```

- Deploy and test

## Lesson 12

**Refactor a CDK stack and change Lambda function architecture to ARM**

Description: _Our CDK stack code is getting rather repetitive. In this quick lesson, we're going to refactor it a little bit and introduce a new architecture for our Lambda function - [a recently announced ARM support.](https://aws.amazon.com/blogs/aws/aws-lambda-functions-powered-by-aws-graviton2-processor-run-your-functions-on-arm-and-get-up-to-34-better-price-performance/)_

Steps:

- Refactor lambda functions to use the following:

```ts
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
```

## Lesson 13

**Use logging and X-Ray to debug performance issues in AppSync API**

Description: _GraphQL is excellent because it allows us to call multiple APIs with a single query. This fact can also be its downfall - what happens if one of the underlying APIs is slow? The whole query is slowed down as a result, and this can be difficult to debug._

_In this quick lesson we're going to learn how to enable logging and AWS X-Ray in order to get a better visibility into our AppSync API._

Steps:

- Enable logging & X-ray:

```ts
logConfig: {
  fieldLogLevel: appsync.FieldLogLevel.ALL,
},
xRayEnabled: true
```

- Add a wait function to one of the resolvers

```ts
const wait = (timeoutMs: number) =>
  new Promise((resolve) => setTimeout(resolve, timeoutMs));
```

## Lesson 14

**Add an updateBook mutation to AppSync GraphQL API**

Description: _Whenever we create a book, there are no reviews, rating or `completed` flag. In this lesson, we're going to learn how to implement an `updateBook` mutation in order to be able to update the properties of an already existing book. In addition to that, we're going to learn how to use [dynoexpr](https://github.com/tuplo/dynoexpr) in order to implement that functionality without introducing unnecessary complexity_

## Lesson 15

**Add a GraphQL subscription to an AppSync API**

Steps:

- First, edit the schema

```graphql
type Subscription {
  onCreateBook: Book @aws_subscribe(mutations: ["createBook"])
}
```

- Then show a subscription being updated side by side with the GraphQL playground

## Lesson 16

**Delete a CDK stack**
