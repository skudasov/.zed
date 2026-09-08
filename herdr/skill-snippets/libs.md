# Go: libraries we use
## zerolog (github.com/rs/zerolog)
- Use github.com/rs/zerolog for all logging.
- Read the level from the ${APP}_LOG_LEVEL env var, where ${APP} is the name of application we develop; default to "debug" when unset or invalid.
- Default to the console (text) writer on stderr.
- Set a global level once at startup from environment variable
- Log structured fields: log.Info().Str("key", v).Err(err).Msg("..."); no fmt.Printf for app logs.
## resty (github.com/go-resty/resty)
- Use resty for HTTP(S) calls.
- Build one shared client and reuse it across requests; set a timeout, e.g. client.SetTimeout(10 * time.Second).
- Read base URLs and endpoints from env (e.g. API_BASE_URL) instead of hardcoding.
- Pass ctx through SetContext(ctx) so requests respect cancellation.
- SetResult(&dst) to unmarshal JSON into a struct; a non-2xx status is not an error unless IsErrorState is used or the body is checked.
- Handle the returned error per the error-handling snippet; wrap with context when it leaves the caller.