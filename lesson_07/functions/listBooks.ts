import { AppSyncResolverHandler } from "aws-lambda";
import { DynamoDB } from "aws-sdk";

type Book = {
  id: string;
  name: string;
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
