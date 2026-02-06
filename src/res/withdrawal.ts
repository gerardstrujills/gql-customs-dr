import { Field, InputType } from "type-graphql";
import { TrimmedStringField } from "../utils/decorators/string";
import { BulkWithdrawalInput } from "./bulk-withdrawal-input";

@InputType()
export class WithdrawalInput {
  @Field(() => Number)
  productId: number;

  @Field(() => String)
  @TrimmedStringField()
  title: string;

  @Field(() => Number)
  quantity: number;

  @Field(() => Date)
  endTime: Date;
}

@InputType()
export class WithdrawalUpdateInput {
  @Field(() => String)
  @TrimmedStringField()
  title: string;

  @Field(() => Number)
  quantity: number;

  @Field(() => Date)
  endTime: Date;
}

export { BulkWithdrawalInput };
