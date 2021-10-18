import { AppSyncResolverHandler } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { Book, MutationUpdateBookArgs } from "../types/books";
import dynoexpr from "@tuplo/dynoexpr";

const documentClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  MutationUpdateBookArgs,
  Book | null
> = async (event) => {
  try {
    const book = event.arguments.book;
    if (!process.env.BOOKS_TABLE) {
      console.error("Error: BOOKS_TABLE was not specified");

      return null;
    }

    const params = dynoexpr<DynamoDB.DocumentClient.UpdateItemInput>({
      TableName: process.env.BOOKS_TABLE,
      Key: { id: book.id },
      ReturnValues: "ALL_NEW",
      Update: {
        ...(book.title !== undefined ? { title: book.title } : {}),
        ...(book.rating !== undefined ? { rating: book.rating } : {}),
        ...(book.completed !== undefined ? { completed: book.completed } : {}),
      },
    });

    console.log("params", params);

    const result = await documentClient.update(params).promise();

    console.log("result", result);

    return result.Attributes as Book;
  } catch (error) {
    console.error("Whoops", error);

    return null;
  }
};
