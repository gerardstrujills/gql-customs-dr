import {
  Arg,
  Field,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import {
  BulkProductItemResponse,
  ProductBulkResponse,
  ProductInput,
} from "../res/product";
import { Product } from "../schemas/product";
import {
  ProductBulkCreateInput,
  validateProduct,
  validateProductBulk,
} from "../validator/product";

@ObjectType()
class ProductFieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class ProductResponse {
  @Field(() => [ProductFieldError], { nullable: true })
  errors?: ProductFieldError[];

  @Field(() => Product, { nullable: true })
  product?: Product;
}

@Resolver(Product)
export class ProductResolver {
  @Mutation(() => ProductBulkResponse)
  async bulkCreateProducts(
    @Arg("input") input: ProductBulkCreateInput,
  ): Promise<ProductBulkResponse> {
    // Validar la lista completa
    const bulkErrors = validateProductBulk(input.products);

    if (bulkErrors) {
      return {
        errors: bulkErrors,
        results: [],
        totalCreated: 0,
        totalFailed: input.products.length,
      };
    }

    const results: BulkProductItemResponse[] = [];
    let totalCreated = 0;
    let totalFailed = 0;

    // Procesar cada producto en la lista
    for (let i = 0; i < input.products.length; i++) {
      const productInput = input.products[i];

      try {
        // Verificar si ya existe en la base de datos
        const existingProduct = await Product.createQueryBuilder("p")
          .where(`"p"."title" = :title`, {
            title: productInput.title,
          })
          .getOne();

        if (existingProduct) {
          results.push({
            index: i,
            error: {
              index: i,
              field: "title",
              message: "El producto ya existe en la base de datos",
            },
          });
          totalFailed++;
          continue;
        }

        // Crear el nuevo producto
        const product = Product.create({
          title: productInput.title.trim(),
          description: productInput.description
            ? productInput.description.trim()
            : null,
          unitOfMeasurement: productInput.unitOfMeasurement.trim(),
          materialType: productInput.materialType.trim(),
        });

        await product.save();

        results.push({
          index: i,
          product,
        });
        totalCreated++;
      } catch (error) {
        console.error(`Error creando producto en índice ${i}:`, error);

        results.push({
          index: i,
          error: {
            index: i,
            field: "error",
            message: `Error interno al crear el producto: ${error.message}`,
          },
        });
        totalFailed++;
      }
    }

    return {
      results,
      totalCreated,
      totalFailed,
    };
  }

  @Query(() => [Product], { nullable: true })
  async products(): Promise<Product[] | null> {
    try {
      const product = await Product.createQueryBuilder("s")
        .select([
          `"s"."id" as id`,
          `"s"."title" as title`,
          `COALESCE("s"."description", null) as "description"`,
          `"s"."unitOfMeasurement" as "unitOfMeasurement"`,
          `"s"."materialType" as "materialType"`,
          `CAST(s.createdAt as TIMESTAMP) as "createdAt"`,
          `CAST(s.updatedAt as TIMESTAMP) as "updatedAt"`,
          `(
            SELECT COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', e.id,
                  'quantity', e.quantity - COALESCE((
                    SELECT SUM(w.quantity)
                    FROM withdrawal w
                    WHERE w."productId" = e."productId"
                  ), 0),
                  'price', e.price,
                  'startTime', TO_CHAR(e."startTime", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                  'createdAt', TO_CHAR(e."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                  'updatedAt', TO_CHAR(e."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                  'supplier', JSON_BUILD_OBJECT(
                    'id', p.id,
                    'name', p.name,
                    'ruc', COALESCE(p.ruc, null),
                    'address', COALESCE(p.address, null),
                    'district', COALESCE(p.district, null),
                    'province', COALESCE(p.province, null),
                    'department', COALESCE(p.department, null),
                    'productCount', (SELECT COUNT(*) FROM entry e WHERE e."supplierId" = p.id),
                    'createdAt', TO_CHAR(p."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                    'updatedAt', TO_CHAR(p."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                  )
                )
              ), '[]'
            ) FROM entry e
            LEFT JOIN supplier p ON e."supplierId" = p.id
            WHERE e."productId" = s.id
          ) AS "entry"`,
          `(
            SELECT COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', w.id,
                  'title', COALESCE(w.title, null),
                  'quantity', w.quantity,
                  'endTime', TO_CHAR(w."endTime", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                  'createdAt', TO_CHAR(w."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                  'updatedAt', TO_CHAR(w."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                )
              ), '[]'
            ) FROM withdrawal w WHERE w."productId" = s.id
          ) AS "withdrawal"`,
        ])
        .groupBy("s.id")
        .orderBy("s.id", "DESC")
        .getRawMany();
      return product || null;
    } catch (e) {
      console.log("error:", e);
      return null;
    }
  }

  @Mutation(() => ProductResponse)
  async createProduct(
    @Arg("input") input: ProductInput,
  ): Promise<ProductResponse> {
    const errors = validateProduct(input);

    if (errors) {
      return { errors };
    }

    try {
      const query = await Product.createQueryBuilder("p")
        .createQueryBuilder()
        .select("*")
        .from(Product, "p")
        .where(
          `"p"."title" = :title AND "p"."unitOfMeasurement" = :unitOfMeasurement AND "p"."materialType" = :materialType`,
          {
            title: input.title,
            unitOfMeasurement: input.unitOfMeasurement,
            materialType: input.materialType,
          },
        )

        .orderBy("(SELECT NULL)")
        .offset(0)
        .limit(1)
        .getRawOne();

      if (query) {
        return {
          errors: [
            {
              field: "title",
              message: "El producto se ha creado anteriormente",
            },
          ],
        };
      }

      const product = Product.create({
        title: input.title,
        description: input.description,
        unitOfMeasurement: input.unitOfMeasurement,
        materialType: input.materialType,
      });
      await product.save();

      return { product };
    } catch (e) {
      console.log(e);
      return {
        errors: [
          {
            field: "error",
            message: "Hubo un problema al cotizar un producto para la compañia",
          },
        ],
      };
    }
  }

  @Mutation(() => ProductResponse)
  async updateProduct(
    @Arg("id") id: number,
    @Arg("input") input: ProductInput,
  ): Promise<ProductResponse> {
    const errors = validateProduct(input);

    if (errors) {
      return { errors };
    }

    try {
      const existingProduct = await Product.findOne({ where: { id } });
      if (!existingProduct) {
        return {
          errors: [
            {
              field: "id",
              message: "El producto no existe",
            },
          ],
        };
      }

      const duplicateProduct = await Product.createQueryBuilder("p")
        .where(
          `"p"."title" = :title AND "p"."unitOfMeasurement" = :unitOfMeasurement AND "p"."materialType" = :materialType AND "p"."id" != :id`,
          {
            title: input.title.trim(),
            unitOfMeasurement: input.unitOfMeasurement.trim(),
            materialType: input.materialType.trim(),
            id,
          },
        )
        .getOne();

      if (duplicateProduct) {
        return {
          errors: [
            {
              field: "title",
              message: "Ya existe otro producto con los mismos datos",
            },
          ],
        };
      }

      Object.assign(existingProduct, input);
      await existingProduct.save();

      return { product: existingProduct };
    } catch (e) {
      console.log(e);
      return {
        errors: [
          {
            field: "title",
            message: `"Hubo un problema al actualizar el producto: ${e.message}"`,
          },
        ],
      };
    }
  }

  @Mutation(() => Boolean)
  async deleteProduct(@Arg("id", () => Int) id: number) {
    try {
      const product = await Product.findOne({
        where: { id },
      });

      if (!product) {
        return false;
      }

      await product.remove();
      return true;
    } catch (e) {
      console.log("Error deleted product and Quote", e);
      return false;
    }
  }
}
