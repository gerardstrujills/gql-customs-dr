// src/resolvers/stock.resolver.ts
import {
  Arg,
  Field,
  Float,
  InputType,
  Int,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { Product } from "../schemas/product";

@InputType()
class StockFilters {
  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  unitOfMeasurement?: string;

  @Field(() => String, { nullable: true })
  materialType?: string;

  @Field(() => Date, { nullable: true })
  startTime?: Date;

  @Field(() => Date, { nullable: true })
  endTime?: Date;

  @Field(() => String, { nullable: true })
  supplierName?: string;

  @Field(() => String, { nullable: true })
  supplierRuc?: string;

  @Field(() => String, { nullable: true })
  supplierDistrict?: string;

  @Field(() => String, { nullable: true })
  supplierProvince?: string;

  @Field(() => String, { nullable: true })
  supplierDepartment?: string;
}

@ObjectType()
class StockResponse {
  @Field(() => Int)
  id: number;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String)
  unitOfMeasurement: string;

  @Field(() => String)
  materialType: string;

  @Field(() => Int)
  totalStock: number;

  @Field(() => Float)
  averagePrice: number;

  @Field(() => Float)
  totalValue: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@Resolver()
export class StockResolver {
  @Query(() => [StockResponse], { nullable: true })
  async stock(
    @Arg("filters", () => StockFilters, { nullable: true })
    filters?: StockFilters
  ): Promise<StockResponse[] | null> {
    try {
      let query = Product.createQueryBuilder("p").select([
        `p.id as id`,
        `p.title as title`,
        `p.description as description`,
        `p."unitOfMeasurement" as "unitOfMeasurement"`,
        `p."materialType" as "materialType"`,
        `CAST(p."createdAt" as TIMESTAMP) as "createdAt"`,
        `CAST(p."updatedAt" as TIMESTAMP) as "updatedAt"`,
        `(
            (SELECT COALESCE(SUM(e.quantity), 0) FROM entry e WHERE e."productId" = p.id)
            -
            (SELECT COALESCE(SUM(w.quantity), 0) FROM withdrawal w WHERE w."productId" = p.id)
          ) as "totalStock"`,
        `(
            SELECT COALESCE(AVG(e.price), 0)
            FROM entry e
            WHERE e."productId" = p.id
          ) as "averagePrice"`,
        `(
            (SELECT COALESCE(SUM(e.quantity * e.price), 0) FROM entry e WHERE e."productId" = p.id)
            -
            (SELECT COALESCE(SUM(w.quantity), 0) FROM withdrawal w WHERE w."productId" = p.id)
            *
            (SELECT COALESCE(AVG(e.price), 0) FROM entry e WHERE e."productId" = p.id)
          ) as "totalValue"`,
      ]);

      // Aplicar filtros de producto
      if (filters) {
        if (filters.description) {
          query = query.andWhere("p.description ILIKE :description", {
            description: `%${filters.description}%`,
          });
        }

        if (filters.unitOfMeasurement) {
          query = query.andWhere('p."unitOfMeasurement" = :unitOfMeasurement', {
            unitOfMeasurement: filters.unitOfMeasurement,
          });
        }

        if (filters.materialType) {
          query = query.andWhere('p."materialType" = :materialType', {
            materialType: filters.materialType,
          });
        }

        // Filtros por fecha (considerando entries)
        if (filters.startTime && filters.endTime) {
          query = query.andWhere(
            `EXISTS (
              SELECT 1 FROM entry e 
              WHERE e."productId" = p.id 
              AND e."startTime" BETWEEN :startTime AND :endTime
            )`,
            {
              startTime: filters.startTime,
              endTime: filters.endTime,
            }
          );
        }

        // Filtros por supplier
        if (
          filters.supplierName ||
          filters.supplierRuc ||
          filters.supplierDistrict ||
          filters.supplierProvince ||
          filters.supplierDepartment
        ) {
          let supplierConditions: string[] = [];
          // Definir el tipo explícitamente
          let parameters: { [key: string]: string } = {};

          if (filters.supplierName) {
            supplierConditions.push(`s.name ILIKE :supplierName`);
            parameters["supplierName"] = `%${filters.supplierName}%`;
          }
          if (filters.supplierRuc) {
            supplierConditions.push(`s.ruc ILIKE :supplierRuc`);
            parameters["supplierRuc"] = `%${filters.supplierRuc}%`;
          }
          if (filters.supplierDistrict) {
            supplierConditions.push(`s.district ILIKE :supplierDistrict`);
            parameters["supplierDistrict"] = `%${filters.supplierDistrict}%`;
          }
          if (filters.supplierProvince) {
            supplierConditions.push(`s.province ILIKE :supplierProvince`);
            parameters["supplierProvince"] = `%${filters.supplierProvince}%`;
          }
          if (filters.supplierDepartment) {
            supplierConditions.push(`s.department ILIKE :supplierDepartment`);
            parameters[
              "supplierDepartment"
            ] = `%${filters.supplierDepartment}%`;
          }

          query = query.andWhere(
            `EXISTS (
              SELECT 1 FROM entry e 
              INNER JOIN supplier s ON e."supplierId" = s.id
              WHERE e."productId" = p.id
              AND (${supplierConditions.join(" OR ")})
            )`,
            parameters
          );
        }
      }

      const result = await query.orderBy("p.createdAt", "DESC").getRawMany();

      return result.map((item) => ({
        ...item,
        totalStock: parseInt(item.totalStock),
        averagePrice: parseFloat(item.averagePrice),
        totalValue: parseFloat(item.totalValue),
      })) as StockResponse[];
    } catch (error) {
      console.log("Error fetching stock:", error);
      return null;
    }
  }
}
