# bollsvenskan-api

Now trying to get it up and running on heroku

To restore the DB from heroku to local use the following command:

`pg_restore --clean -h <host> -p <port> -U <username> -d <dbname> <backup_file>`
