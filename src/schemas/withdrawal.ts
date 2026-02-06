import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Product } from "./product";

@ObjectType()
@Entity()
export class Withdrawal extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Int, { nullable: true })
  @Column({ type: "int", nullable: true })
  productId: number;

  @Field(() => Product, { nullable: true })
  @ManyToOne(() => Product, (p) => p.withdrawals, {
    onDelete: "CASCADE",
    eager: true, // Esto carga automáticamente la relación
  })
  @JoinColumn({ name: "productId", referencedColumnName: "id" })
  product: Product;

  @Field(() => String, { nullable: true })
  @Column({ type: "text", nullable: true })
  title: string | null;

  @Field(() => Number)
  @Column({ type: "integer", nullable: false })
  quantity: number;

  @Field(() => Date)
  @Column({ type: "timestamp", nullable: false })
  endTime: Date;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  updatedAt: Date;
}
