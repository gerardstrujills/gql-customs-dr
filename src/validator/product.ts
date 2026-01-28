import { Field, InputType } from "type-graphql";
import { ProductInput } from "../res/product";
import { TrimmedStringField } from "../utils/decorators/string";

export const validateProduct = (options: ProductInput) => {
  if (
    !options.title ||
    options.title.trim().length < 4 ||
    options.title.length > 255
  ) {
    return [
      {
        field: "title",
        message: "El título debe tener entre 4 y 255 caracteres",
      },
    ];
  }

  if (
    !options.unitOfMeasurement ||
    options.unitOfMeasurement.trim().length < 2 ||
    options.unitOfMeasurement.length > 255
  ) {
    return [
      {
        field: "unitOfMeasurement",
        message: "La medida debe tener entre 2 y 255 caracteres",
      },
    ];
  }

  if (
    !options.materialType ||
    options.materialType.trim().length < 2 ||
    options.materialType.length > 255
  ) {
    return [
      {
        field: "materialType",
        message: "El material debe tener entre 2 y 255 caracteres",
      },
    ];
  }

  if (options.description !== null) {
    if (
      !options.description ||
      options.description.trim().length < 4 ||
      options.description.length > 255
    ) {
      return [
        {
          field: "description",
          message: "La descripción debe tener entre 4 y 255 caracteres",
        },
      ];
    }
  }

  return null;
};

export const validateProductBulk = (products: ProductBulkInput[]) => {
  const errors: Array<{
    index: number;
    field: string;
    message: string;
  }> = [];

  // Validar que la lista no esté vacía
  if (!products || products.length === 0) {
    return [
      {
        index: -1,
        field: "products",
        message: "La lista de productos no puede estar vacía",
      },
    ];
  }

  // Validar cada producto individualmente
  products.forEach((product, index) => {
    if (
      !product.title ||
      product.title.trim().length < 4 ||
      product.title.length > 255
    ) {
      errors.push({
        index,
        field: "title",
        message: "El título debe tener entre 4 y 255 caracteres",
      });
    }

    if (
      !product.unitOfMeasurement ||
      product.unitOfMeasurement.trim().length < 2 ||
      product.unitOfMeasurement.length > 255
    ) {
      errors.push({
        index,
        field: "unitOfMeasurement",
        message: "La medida debe tener entre 2 y 255 caracteres",
      });
    }

    if (
      !product.materialType ||
      product.materialType.trim().length < 2 ||
      product.materialType.length > 255
    ) {
      errors.push({
        index,
        field: "materialType",
        message: "El material debe tener entre 2 y 255 caracteres",
      });
    }

    if (product.description !== null && product.description !== undefined) {
      if (
        !product.description ||
        product.description.trim().length < 4 ||
        product.description.length > 255
      ) {
        errors.push({
          index,
          field: "description",
          message: "La descripción debe tener entre 4 y 255 caracteres",
        });
      }
    }
  });

  // NOTA: Se quitó la validación de duplicados en la lista
  // El backend ya verifica duplicados contra la base de datos
  // Si hay duplicados en la lista enviada, el backend los creará o mostrará error según existan en DB

  return errors.length > 0 ? errors : null;
};

@InputType()
export class ProductBulkInput {
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

@InputType()
export class ProductBulkCreateInput {
  @Field(() => [ProductBulkInput])
  products: ProductBulkInput[];
}
