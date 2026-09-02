import { AppError } from "../../app/common/errors/app-error";
import { generateSlug } from "../../app/common/utils/generate-slug";
import { prisma } from "../../lib/prisma";


interface UpdateCompanyInput {
  name?: string;
}

export class CompanyService {
  static async getMyCompany(ownerId: string) {
    const company = await prisma.company.findUnique({
      where: {
        ownerId,
      },
    });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return company;
  }

  static async updateMyCompany(
    ownerId: string,
    data: UpdateCompanyInput
  ) {
    const company = await prisma.company.findUnique({
      where: {
        ownerId,
      },
    });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    let slug = company.slug;

    if (data.name && data.name !== company.name) {
      const baseSlug = generateSlug(data.name);

      slug = baseSlug;
      let counter = 1;

      while (
        await prisma.company.findFirst({
          where: {
            slug,
            id: {
              not: company.id,
            },
          },
        })
      ) {
        counter += 1;
        slug = `${baseSlug}-${counter}`;
      }
    }

    return prisma.company.update({
      where: {
        id: company.id,
      },

      data: {
        ...(data.name !== undefined && {
          name: data.name,
          slug,
        }),
      },
    });
  }
}