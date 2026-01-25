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
  BulkEntryError,
  BulkEntryResponse,
  BulkEntryResult,
} from "../res/bulk-entry";
import { BulkEntryInput, EntryInput, EntryUpdateInput } from "../res/entry";
import { Entry } from "../schemas/entry";
import { Product } from "../schemas/product";
import { Supplier } from "../schemas/supplier";
import { validateEntry, validateUpdateEntry } from "../validator/entry";

@ObjectType()
class EntryFieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class EntryResponse {
  @Field(() => [EntryFieldError], { nullable: true })
  errors?: EntryFieldError[];

  @Field(() => Entry, { nullable: true })
  entry?: Entry;
}

@Resolver(Entry)
export class EntryResolver {
  @Mutation(() => BulkEntryResponse)
  async createBulkEntries(
    @Arg("input") input: BulkEntryInput,
  ): Promise<BulkEntryResponse> {
    const results: BulkEntryResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Validar todos los registros primero
    for (let i = 0; i < input.entries.length; i++) {
      const entryInput = input.entries[i];
      const errors: BulkEntryError[] = [];

      // Validaciones básicas
      const validationErrors = validateEntry(entryInput);
      if (validationErrors) {
        validationErrors.forEach((error) => {
          errors.push({
            index: i,
            field: error.field,
            message: error.message,
            ruc: entryInput.ruc,
            productId: entryInput.productId,
          });
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Validar que el RUC exista
      const supplier = await Supplier.findOne({
        where: { ruc: entryInput.ruc },
      });
      if (!supplier) {
        errors.push({
          index: i,
          field: "ruc",
          message: "RUC no existente",
          ruc: entryInput.ruc,
          productId: entryInput.productId,
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Validar que el productId exista
      const product = await Product.findOne({
        where: { id: entryInput.productId },
      });
      if (!product) {
        errors.push({
          index: i,
          field: "productId",
          message: "Producto no existente",
          ruc: entryInput.ruc,
          productId: entryInput.productId,
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Verificar si ya existe un registro idéntico
      const existingEntry = await Entry.createQueryBuilder("e")
        .where(
          `"e"."productId" = :productId AND "e"."supplierId" = :supplierId AND "e"."quantity" = :quantity AND "e"."price" = :price AND "e"."startTime" = :startTime`,
          {
            productId: entryInput.productId,
            supplierId: supplier.id,
            quantity: entryInput.quantity,
            price: entryInput.price,
            startTime: entryInput.startTime,
          },
        )
        .getOne();

      if (existingEntry) {
        errors.push({
          index: i,
          field: "general",
          message: "El registro ya existe",
          ruc: entryInput.ruc,
          productId: entryInput.productId,
        });
        errorCount++;
        results.push({ errors });
        continue;
      }

      // Si pasa todas las validaciones, crear el registro
      try {
        const create = Entry.create({
          productId: entryInput.productId,
          supplierId: supplier.id,
          price: entryInput.price,
          quantity: entryInput.quantity,
          startTime: entryInput.startTime,
        });

        await create.save();

        // Obtener el registro completo con relaciones
        const entry: Entry | undefined = await Entry.createQueryBuilder("s")
          .select([
            `"s"."id" as id`,
            `"s"."quantity" as quantity`,
            `"s"."price" as price`,
            `CAST(s.startTime as TIMESTAMP) as "startTime"`,
            `CAST(s.createdAt as TIMESTAMP) as "createdAt"`,
            `CAST(s.updatedAt as TIMESTAMP) as "updatedAt"`,
            `JSON_BUILD_OBJECT(
              'id', p.id,
              'name', p.name,
              'ruc', COALESCE(p.ruc, null),
              'district', COALESCE(p.district, null),
              'province', COALESCE(p.province, null),
              'department', COALESCE(p.department, null),
              'productCount', (SELECT COUNT(*) FROM entry e WHERE e."supplierId" = p.id),
              'createdAt', TO_CHAR(p."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'updatedAt', TO_CHAR(p."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            ) AS "supplier"`,
            `JSON_BUILD_OBJECT(
              'id', prod.id,
              'title', prod.title,
              'description', COALESCE(prod.description, null),
              'unitOfMeasurement', prod."unitOfMeasurement",
              'materialType', prod."materialType",
              'createdAt', TO_CHAR(prod."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'updatedAt', TO_CHAR(prod."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            ) AS "product"`,
          ])
          .leftJoin(Supplier, "p", `p.id = s."supplierId"`)
          .leftJoin(Product, "prod", `prod.id = s."productId"`)
          .where("s.id = :id", { id: create.id })
          .getRawOne();

        successCount++;
        results.push({ entry });
      } catch (error) {
        console.error(`Error creando registro ${i}:`, error);
        errors.push({
          index: i,
          field: "general",
          message: `Error al crear el registro: ${error.message}`,
          ruc: entryInput.ruc,
          productId: entryInput.productId,
        });
        errorCount++;
        results.push({ errors });
      }
    }

    return {
      results,
      total: input.entries.length,
      successCount,
      errorCount,
    };
  }

  @Query(() => [Entry], { nullable: true })
  async entries(): Promise<Entry[] | null> {
    try {
      const entry = await Entry.find({
        order: {
          createdAt: "DESC",
        },
      });
      return entry || null;
    } catch (e) {
      console.log("entries:", e);
      return null;
    }
  }

  @Mutation(() => EntryResponse)
  async createEntry(@Arg("input") input: EntryInput): Promise<EntryResponse> {
    const errors = validateEntry(input);

    if (errors) {
      return { errors };
    }

    try {
      const supplier = await Supplier.findOne({ where: { ruc: input.ruc } });

      if (!supplier) {
        return {
          errors: [
            {
              field: "ruc",
              message: "Ruc no existente",
            },
          ],
        };
      }

      const query = await Entry.createQueryBuilder("e")
        .where(
          `"e"."productId" = :productId AND "e"."supplierId" = :supplierId AND "e"."quantity" = :quantity AND "e"."price" = :price AND "e"."startTime" = :startTime`,
          {
            productId: input.productId,
            supplierId: supplier.id,
            quantity: input.quantity,
            price: input.price,
            startTime: input.startTime,
          },
        )
        .orderBy("e.id", "ASC")
        .limit(1)
        .getRawOne();

      if (query) {
        return {
          errors: [
            {
              field: "ruc",
              message: "Producto entrada se ha creado anteriormente",
            },
          ],
        };
      }

      const create = Entry.create({
        productId: input.productId,
        supplierId: supplier.id,
        price: input.price,
        quantity: input.quantity,
        startTime: input.startTime,
      });

      await create.save();

      const entry: Entry | undefined = await Entry.createQueryBuilder("s")
        .select([
          `"s"."id" as id`,
          `"s"."quantity" as quantity`,
          `"s"."price" as price`,
          `CAST(s.startTime as TIMESTAMP) as "startTime"`,
          `CAST(s.createdAt as TIMESTAMP) as "createdAt"`,
          `CAST(s.updatedAt as TIMESTAMP) as "updatedAt"`,
          `JSON_BUILD_OBJECT(
             'id', p.id,
             'name', p.name,
             'ruc', COALESCE(p.ruc, null),
             'district', COALESCE(p.district, null),
             'province', COALESCE(p.province, null),
             'department', COALESCE(p.department, null),
             'productCount', (SELECT COUNT(*) FROM entry e WHERE e."supplierId" = p.id),
             'createdAt', TO_CHAR(p."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'updatedAt', TO_CHAR(p."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
         ) AS "supplier"`,
        ])
        .leftJoin(Supplier, "p", `p.id = s."supplierId"`)
        .where("s.id = :id", { id: create.id })
        .getRawOne();

      return { entry };
    } catch (e) {
      console.log(e);
      return {
        errors: [
          {
            field: "ruc",
            message: "Ocurrió un error al crear la entrada.",
          },
        ],
      };
    }
  }

  @Mutation(() => EntryResponse)
  async updateEntry(
    @Arg("id", () => Int) id: number,
    @Arg("input") input: EntryUpdateInput,
  ): Promise<EntryResponse> {
    const errors = validateUpdateEntry(input);

    if (errors) {
      return { errors };
    }

    try {
      const existing = await Entry.findOne({ where: { id } });
      if (!existing) {
        return {
          errors: [
            {
              field: "id",
              message: "Producto entrada no existente",
            },
          ],
        };
      }

      Object.assign(existing, input);
      await existing.save();

      const entry: Entry | undefined = await Entry.createQueryBuilder("s")
        .select([
          `"s"."id" as id`,
          `"s"."quantity" as quantity`,
          `"s"."price" as price`,
          `CAST(s.startTime as TIMESTAMP) as "startTime"`,
          `CAST(s.createdAt as TIMESTAMP) as "createdAt"`,
          `CAST(s.updatedAt as TIMESTAMP) as "updatedAt"`,
          `JSON_BUILD_OBJECT(
           'id', p.id,
           'name', p.name,
           'ruc', COALESCE(p.ruc, null),
           'district', COALESCE(p.district, null),
           'province', COALESCE(p.province, null),
           'department', COALESCE(p.department, null),
           'productCount', (SELECT COUNT(*) FROM entry e WHERE e."supplierId" = p.id),
           'createdAt', TO_CHAR(p."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'updatedAt', TO_CHAR(p."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
       ) AS "supplier"`,
        ])
        .leftJoin(Supplier, "p", `p.id = s."supplierId"`)
        .where("s.id = :id", { id })
        .getRawOne();

      return { entry };
    } catch (e) {
      console.log(e);
      return {
        errors: [
          {
            field: "title",
            message: `"Hubo un problema al actualizar el Entryo: ${e.message}"`,
          },
        ],
      };
    }
  }

  @Mutation(() => Boolean)
  async deleteEntry(@Arg("id", () => Int) id: number) {
    try {
      const entry = await Entry.findOne({
        where: { id },
      });

      if (!entry) {
        return false;
      }

      await entry.remove();
      return true;
    } catch (e) {
      console.log("Error deleted entry and Quote", e);
      return false;
    }
  }
}
