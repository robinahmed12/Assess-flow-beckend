import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions: swaggerJsdoc.Options = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "API Documentation",
			version: "1.0.0",
			description: "Express.js API documentation",
		},
		servers: [
			{
				url: "http://localhost:5000",
				description: "Local development server",
			},
		],
	},
	apis: ["./src/app/modules/**/*.route.ts", "./src/app/routes/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);