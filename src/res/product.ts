import { Field, InputType, Int, ObjectType } from "type-graphql";
import { Product } from "../schemas/product";
import { TrimmedStringField } from "../utils/decorators/string";

@InputType()
export class ProductInput {
  @Field(() => String)
  @TrimmedStringField()
  title: string;

  @Field({ nullable: true })
  @TrimmedStringField()
  description: string;

  @Field(() => String)
  @TrimmedStringField()
  unitOfMeasurement: string;

  @Field(() => String)
  @TrimmedStringField()
  materialType: string;
}

@ObjectType()
export class ProductBulkError {
  @Field(() => Int)
  index: number;

  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
export class BulkProductItemResponse {
  @Field(() => Int)
  index: number;

  @Field(() => Product, { nullable: true })
  product?: Product;

  @Field(() => ProductBulkError, { nullable: true })
  error?: ProductBulkError;
}

@ObjectType()
export class ProductBulkResponse {
  @Field(() => [ProductBulkError], { nullable: true })
  errors?: ProductBulkError[];

  @Field(() => [BulkProductItemResponse])
  results: BulkProductItemResponse[];

  @Field(() => Int)
  totalCreated: number;

  @Field(() => Int)
  totalFailed: number;
}
