import { Field, InputType } from "type-graphql";
import { WithdrawalInput } from "./withdrawal";

@InputType()
export class BulkWithdrawalInput {
  @Field(() => [WithdrawalInput])
  withdrawals: Array<{
    productId: number;
    title: string;
    quantity: number;
    endTime: Date;
  }>;
}
