// /Users/gerardotrujillo/Documents/Stack/GitHub/almacen/gqlcustoms/src/res/bulk-withdrawal.ts
import { Field, Int, ObjectType } from "type-graphql";
import { Withdrawal } from "../schemas/withdrawal";

@ObjectType()
export class BulkWithdrawalError {
  @Field(() => Int, { nullable: true })
  index?: number;

  @Field(() => String)
  field: string;

  @Field(() => String)
  message: string;

  @Field(() => Number, { nullable: true })
  productId?: number;
}

// Cambiar BulkWithdrawalResult para que use WithdrawalResponse en lugar de Withdrawal directamente
@ObjectType()
export class BulkWithdrawalResult {
  @Field(() => Withdrawal, { nullable: true })
  withdrawal?: Withdrawal;

  @Field(() => [BulkWithdrawalError], { nullable: true })
  errors?: BulkWithdrawalError[];
}

@ObjectType()
export class BulkWithdrawalResponse {
  @Field(() => [BulkWithdrawalResult])
  results: BulkWithdrawalResult[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  successCount: number;

  @Field(() => Int)
  errorCount: number;
}
