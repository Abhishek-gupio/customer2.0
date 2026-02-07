import { dbInstances } from "@repo/db-customer";
import type { CreateUserBody, UpdateUserBody } from "./user.types";

export const userService = {
  async findAll() {
    return dbInstances.user.findMany({ orderBy: { createdAt: "desc" } });
  },

  async findById(id: string) {
    return dbInstances.user.findUnique({ where: { id } });
  },

  async create(data: CreateUserBody) {
    return dbInstances.user.create({ data });
  },

  async update(id: string, data: UpdateUserBody) {
    return dbInstances.user.update({ where: { id }, data });
  },

  async delete(id: string) {
    return dbInstances.user.delete({ where: { id } });
  },
};
