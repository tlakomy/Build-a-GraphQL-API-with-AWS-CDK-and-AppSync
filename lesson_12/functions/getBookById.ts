import { AppSyncResolverHandler } from "aws-lambda";
import { Book, QueryGetBookByIdArgs } from "../types/books";
import { DynamoDB } from "aws-sdk";

const documentClient = new DynamoDB.DocumentClient();

const wait = (timeoutMs: number) =>
  new Promise((resolve) => setTimeout(resolve, timeoutMs));

export const handler: AppSyncResolverHandler<
  QueryGetBookByIdArgs,
  Book | null
> = async (event) => {
  const bookId = event.arguments.bookId;

  try {
    if (!process.env.BOOKS_TABLE) {
      console.error("Error: BOOKS_TABLE was not specified");

      return null;
    }

    await wait(2000);

    const { Item } = await documentClient
      .get({
        TableName: process.env.BOOKS_TABLE,
        Key: { id: bookId },
      })
      .promise();

    return Item as Book;
  } catch (error) {
    console.error("Whoops", error);

    return null;
  }
};
