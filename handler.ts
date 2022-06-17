import "source-map-support/register"
import { Context, APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda"
import aws from "aws-sdk"

const ServerlessClient = require('serverless-postgres')

let ses = new aws.SES({ region: "us-east-1" })
let secrets = new aws.SecretsManager({
  region: "us-east-1"
})

const getSecrets = async (id) => {
    let rds = await secrets.getSecretValue({
      SecretId: id
    }).promise()

    return JSON.parse(rds.SecretString)
}

const getClient = async (config) => {
    const client = new ServerlessClient({
      user: config['PGUSER'],
      host: config['PGHOST'],
      database: config['PGDATABASE'],
      password: config['PGPASSWORD'],
      port: config['PGPORT']
    })
    await client.connect()
    return client
}

// generate random alphanumeric string
const rand = () => {
    return Math.random().toString(36).substr(2)
}

// more entropy
const generateToken = () => {
    return rand() + rand()
}

const getCookie= (event, key) => {
  let b = event.headers?.cookie?.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)")
  return b ? b.pop() : ""
}

const getBodyData= (event, key) => {
  let b = event.body?.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)")
  return b ? b.pop() : ""
}

export const serve = async (event: APIGatewayEvent, _context: Context): Promise<APIGatewayProxyResultV2> => {
  try {
    // handle user request to send verification email
    if (event.httpMethod == "POST" && event.path == "/email") {
      // generate verification token
      const token = generateToken()

      // get email from path
      const email = decodeURIComponent(getBodyData(event, 'email'))

      // save token to email in DB
      const rds_config = await getSecrets('RDS')
      const client = await getClient(rds_config)

      // just going to replace here for this exercise
      const sql = `
        INSERT INTO ta."user"
        (email, "token")
        VALUES($1, $2)
        ON CONFLICT (email)
        DO
          UPDATE SET token = $2
        ;
      `
      const sql_params = [email, token]
      const res = await client.query(sql, sql_params)

      // send token via email
      console.log("Sending email...")
      // Create sendEmail params
      let params = {
        Destination: { /* required */
          ToAddresses: [
            "pjfontillas@gmail.com",
          ]
        },
        Message: { /* required */
          Body: { /* required */
            Html: {
             Charset: "UTF-8",
             Data: `https://ta.lucis.works/verify/${token}/email/${email}`
            },
           },
           Subject: {
            Charset: 'UTF-8',
            Data: 'Email Verification'
           }
          },
        Source: 'no-reply@pjfontillas.com', /* required */
        ReplyToAddresses: [
           'no-reply@pjfontillas.com',
        ],
      }
      await ses.sendEmail(params).promise()

      const render = (await import("./src/server/render")).default;
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/plain",
        },
        body: "Email verification sent. Please check your mailbox.",
      }
    }

    // handle user request to verify email via token
    if (event.httpMethod == "GET" && event.pathParameters && "token" in event.pathParameters && "email" in event.pathParameters) {
      // get token from path
      const email = event.pathParameters.email

      // get token from path
      const token = event.pathParameters.token

      // compare token to token and email pair in DB
      const rds_config = await getSecrets('RDS')
      const client = await getClient(rds_config)

      console.log('connected... running query...')
      let sql = `
        SELECT email FROM ta."user"
        WHERE email = $1 AND token = $2;
      `
      let sql_params = [email, token]
      let res = await client.query(sql, sql_params)

      if (res.rows.length == 1) {
        // mark user as verified
        sql = `
          UPDATE ta."user"
          SET verified=true
          WHERE email=$1;
        `
        sql_params = [email]
        res = await client.query(sql, sql_params)
        // render app with token saved
        const render = (await import("./src/server/render")).default;
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "text/html",
            "Set-Cookie": `token=${token};Domain=ta.lucis.works;path=/`
          },
          body: await render(event),
        }
      } else {
        // token invalid, show 400
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "text/plain",
          },
          body: "Verification token or email invalid.",
        }
      }
    }

    // handle user request to get list of viewers, requires validation
    if (event.httpMethod == "GET" && event.path == "/workers") {
      const rds_config = await getSecrets('RDS')
      const client = await getClient(rds_config)

      // use token to validate user
      const token = getCookie(event, 'token')
      let sql = `
        SELECT *
        FROM ta.user
        WHERE token = $1
      `
      let sql_params = [token]
      let res = await client.query(sql, sql_params)
      if (!res.rows?.[0]?.verified) {
        return {
          statusCode: 403,
          headers: {
            "Content-Type": "text/plain",
          },
          body: "Unauthorized access.",
        }
      }

      // get list of workers from DB, really simple, no pagination, etc.
      sql = `
        SELECT * FROM ta.worker
        ORDER BY id
        ;
      `
      res = await client.query(sql)

      // return as JSON
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/json",
        },
        body: JSON.stringify(res.rows),
      }
    }

    const token = getCookie(event, 'token')
    const render = (await import("./src/server/render")).default;
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      body: await render(event),
    }
  } catch (error) {
    // Custom error handling for server-side errors
    // TODO: Prettify the output, include the callstack, e.g. by using `youch` to generate beautiful error pages
    console.error(error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/html",
      },
      body: `<html><body>${error.toString()}</body></html>`,
    }
  }
};