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
