import { Field, Int, ObjectType } from "type-graphql";
import { Entry } from "../schemas/entry";

@ObjectType()
export class BulkEntryError {
  @Field(() => Int, { nullable: true })
  index?: number;

  @Field(() => String)
  field: string;

  @Field(() => String)
  message: string;

  @Field(() => String, { nullable: true })
  ruc?: string;

  @Field(() => Number, { nullable: true })
  productId?: number;
}

@ObjectType()
export class BulkEntryResult {
  @Field(() => Entry, { nullable: true })
  entry?: Entry;

  @Field(() => [BulkEntryError], { nullable: true })
  errors?: BulkEntryError[];
}

@ObjectType()
export class BulkEntryResponse {
  @Field(() => [BulkEntryResult])
  results: BulkEntryResult[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  successCount: number;

  @Field(() => Int)
  errorCount: number;
}
