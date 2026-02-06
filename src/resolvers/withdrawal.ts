import { Arg, Field, Int, Mutation, ObjectType, Resolver } from "type-graphql";
import {
  BulkWithdrawalError,
  BulkWithdrawalResponse,
  BulkWithdrawalResult,
} from "../res/bulk-withdrawal";
import { BulkWithdrawalInput } from "../res/bulk-withdrawal-input";
import { WithdrawalInput, WithdrawalUpdateInput } from "../res/withdrawal";
import { Entry } from "../schemas/entry";
import { Product } from "../schemas/product";
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

  @Mutation(() => BulkWithdrawalResponse)
  async createBulkWithdrawals(
    @Arg("input") input: BulkWithdrawalInput,
  ): Promise<BulkWithdrawalResponse> {
    const results: BulkWithdrawalResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Primero, calcular el stock disponible por producto
    const productStocks = new Map<number, number>();

    // Obtener todos los productIds únicos
    const uniqueProductIds = [
      ...new Set(input.withdrawals.map((w) => w.productId)),
    ];

    // Calcular stock para cada producto
    for (const productId of uniqueProductIds) {
      const totalEntries = await Entry.createQueryBuilder("entry")
        .select("SUM(entry.quantity)", "total")
        .where("entry.productId = :productId", { productId })
        .getRawOne();

      const totalWithdrawals = await Withdrawal.createQueryBuilder("withdrawal")
        .select("SUM(withdrawal.quantity)", "total")
        .where("withdrawal.productId = :productId", { productId })
        .getRawOne();

      const availableStock =
        parseFloat(totalEntries?.total || "0") -
        parseFloat(totalWithdrawals?.total || "0");

      productStocks.set(productId, availableStock);
    }

    // Validar todos los registros primero
    for (let i = 0; i < input.withdrawals.length; i++) {
      const withdrawalInput = input.withdrawals[i];
      const errors: BulkWithdrawalError[] = [];

      // Validaciones básicas
      const validationErrors = validateWithdrawal(withdrawalInput);
      if (validationErrors) {
        validationErrors.forEach((error) => {
          errors.push({
            index: i,
            field: error.field,
            message: error.message,
            productId: withdrawalInput.productId,
          });
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Validar que el productId exista
      const product = await Product.findOne({
        where: { id: withdrawalInput.productId },
      });
      if (!product) {
        errors.push({
          index: i,
          field: "productId",
          message: "Producto no existente",
          productId: withdrawalInput.productId,
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Validar stock disponible
      const availableStock = productStocks.get(withdrawalInput.productId) || 0;
      if (availableStock < withdrawalInput.quantity) {
        errors.push({
          index: i,
          field: "quantity",
          message: `Stock insuficiente. Disponible: ${availableStock}, Solicitado: ${withdrawalInput.quantity}`,
          productId: withdrawalInput.productId,
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Verificar si ya existe un registro idéntico
      const existingWithdrawal = await Withdrawal.createQueryBuilder("w")
        .where(
          `"w"."productId" = :productId AND "w"."title" = :title AND "w"."quantity" = :quantity AND "w"."endTime" = :endTime`,
          {
            productId: withdrawalInput.productId,
            title: withdrawalInput.title,
            quantity: withdrawalInput.quantity,
            endTime: withdrawalInput.endTime,
          },
        )
        .getOne();

      if (existingWithdrawal) {
        errors.push({
          index: i,
          field: "general",
          message: "El registro de salida ya existe",
          productId: withdrawalInput.productId,
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Si pasa todas las validaciones, crear el registro
      try {
        const withdrawal = Withdrawal.create({
          productId: withdrawalInput.productId,
          title: withdrawalInput.title,
          quantity: withdrawalInput.quantity,
          endTime: withdrawalInput.endTime,
        });

        await withdrawal.save();

        // Actualizar el stock disponible para este producto
        productStocks.set(
          withdrawalInput.productId,
          availableStock - withdrawalInput.quantity,
        );

        // Cargar relaciones con el producto
        const withdrawalWithRelations = await Withdrawal.findOne({
          where: { id: withdrawal.id },
          relations: ["product"],
        });

        successCount++;
        results.push({ withdrawal: withdrawalWithRelations! });
      } catch (error) {
        console.error(`Error creando registro ${i}:`, error);
        errors.push({
          index: i,
          field: "general",
          message: `Error al crear el registro: ${error.message}`,
          productId: withdrawalInput.productId,
        });
        errorCount++;
        results.push({ errors });
      }
    }

    return {
      results,
      total: input.withdrawals.length,
      successCount,
      errorCount,
    };
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
