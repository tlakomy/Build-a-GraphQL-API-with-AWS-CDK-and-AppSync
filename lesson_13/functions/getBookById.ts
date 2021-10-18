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
