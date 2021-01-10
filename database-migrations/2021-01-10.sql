ALTER TABLE "users"
ADD "api_key" character varying(40) NULL;

ALTER TABLE "users"
ADD CONSTRAINT "users_api_key" UNIQUE ("api_key");
