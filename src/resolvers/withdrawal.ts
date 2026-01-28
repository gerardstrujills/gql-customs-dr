import { Arg, Field, Int, Mutation, ObjectType, Resolver } from "type-graphql";
import { WithdrawalInput, WithdrawalUpdateInput } from "../res/withdrawal";
import { Withdrawal } from "../schemas/withdrawal";
import {
  validateUpdateWithdrawal,
  validateWithdrawal,
} from "../validator/withdrawal";

@ObjectType()
class WithdrawalFieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class WithdrawalResponse {
  @Field(() => [WithdrawalFieldError], { nullable: true })
  errors?: WithdrawalFieldError[];

  @Field(() => Withdrawal, { nullable: true })
  withdrawal?: Withdrawal;
}

@Resolver(Withdrawal)
export class WithdrawalResolver {
  @Mutation(() => WithdrawalResponse)
  async createWithdrawal(
    @Arg("input") input: WithdrawalInput,
  ): Promise<WithdrawalResponse> {
    const errors = validateWithdrawal(input);

    if (errors) {
      return { errors };
    }

    try {
      const withdrawal = Withdrawal.create({
        productId: input.productId,
        title: input.title,
        quantity: input.quantity,
        endTime: input.endTime,
      });

      await withdrawal.save();

      return { withdrawal };
    } catch (e) {
      console.log(e);
      return {
        errors: [
          {
            field: "title",
            message: "Ocurrió un error al crear la salida.",
          },
        ],
      };
    }
  }

  @Mutation(() => WithdrawalResponse)
  async updateWithdrawal(
    @Arg("id", () => Int) id: number,
    @Arg("input") input: WithdrawalUpdateInput,
  ): Promise<WithdrawalResponse> {
    const errors = validateUpdateWithdrawal(input);

    if (errors) {
      return { errors };
    }

    try {
      const withdrawal = await Withdrawal.findOne({ where: { id } });
      if (!withdrawal) {
        return {
          errors: [
            {
              field: "id",
              message: "Producto salida no existente",
            },
          ],
        };
      }

      Object.assign(withdrawal, input);
      await withdrawal.save();

      return { withdrawal };
    } catch (e) {
      console.log(e);
      return {
        errors: [
          {
            field: "title",
            message: `"Hubo un problema al actualizar el withdrawal: ${e.message}"`,
          },
        ],
      };
    }
  }

  @Mutation(() => Boolean)
  async deleteWithdrawal(@Arg("id", () => Int) id: number) {
    try {
      const withdrawal = await Withdrawal.findOne({
        where: { id },
      });

      if (!withdrawal) {
        return false;
      }

      await withdrawal.remove();
      return true;
    } catch (e) {
      return false;
    }
  }
}
