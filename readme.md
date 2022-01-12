# YayHooray

Run `docker-compose up`.

- web interface at `http://localhost:3000`
- api at `http://localhost:3100`


### First run?
Mongo takes a bit longer to fire up on first run, the api will throw errors as the process restarts until mongo comes up.

#### First user
While the whole setup is running, run `docker-compose exec api bash` in a separate process and then `node ./cmd/createuser <username> <password> <email>` to create the first user and you should be able to log in.
