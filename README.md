# Bollsvenskan API

<details>
  <summary>DD2482 Easter egg instructions</summary>

  In the [demo video](https://youtu.be/BX7Fa_DdlQc?t=82), at 1m22s, you can see
  just above the `// Start monitoring` comment there is a route to `/devops`
  which has the body of the function hidden. It also has a comment to draw some
  attention to it saying `// Interested in DevOps?`. By following the link
  specified
  ([https://api.bollsvenskan.jacobadlers.com/devops](https://api.bollsvenskan.jacobadlers.com/devops))
  you'll get to the Easter egg, try it out!
</details>

This repo contains the backend for
[bollsvenskan](https://github.com/jadlers/bollsvenskan). Each service required
runs in its own docker container orchestrated with `docker-compose`. The
services used are:

- API server: Built with `nodejs` and the express framework
- Postgresql database
- Adminer: web interface for the database
- Prometheus: Metrics database used for monitoring the API
- Grafana: Used to visualize the monitoring data

Bollsvenskan is a site used for leagues which I run with friends. At the time of
writing this it's been used both for football and DotA. The purpose initially
was simply to keep track of statistics the players and matches. However,
additional features for ELO-rating and balanced team maker are currently being
developed.

## Get started

The only requirements to get the project up and running is `docker` and
`docker-compose`. Note that the project at the moment is not developed very
generic so it may or may not fit your needs.

1. Clone the repo.

2. Copy the file `.env.example` to `.env` and fill it out

3. Run `docker-compose up -d` to start all services.

4. A database will be created with the name you specified for `POSTGRES_DB` in
   `.env`. Although it wont have any tables. A simple way to create them is with
   the Adminer web-interface.

    - The web-interface is available on [localhost:8080](http://localhost:8080)
      (unless you changed the `docker-compose.yml`).

    - Click on "Import" in the top left, select the file `schema.sql` and then
      execute which will create all tables needed.

That's all steps needed to get the API up and running. You can run `curl
localhost:<API_SERVER_PORT from .env>/ping` to make sure it's working.

### Rebuilding the `api_server` container

If you've made changes to the server and want to rebuild the image run the
command `docker-compose up -d --build api_server`. This will rebuild it, stop
the old one and start up the newly created image.

## Database backups

> NOTE: In order to run these commands you need to have them installed locally.
  They should come with an installation of postgresql. It should be possible to
  do with the Adminer web-interface as well.

- Create a new backup:
  - `pg_dump -Fc --host <host> --port <port> --username <username> --dbname <dbname > <backup-file>`
- Restore a backup:
  - `pg_restore --clean --host <host> --port <port> --username <username> --dbname <dbname> <backup_file>`

