import * as React from "react"
import Worker from "./Worker"
import axios from "axios"

export default class Workers extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isLoading: true,
      needAuth: false,
      workers: undefined
    }
  }

  componentDidMount() {
    this.getWorkers()
  }

  getWorkers() {
    axios.get('https://ta.lucis.works/workers')
      .then(results => {
        this.setState({
          isLoading: false,
          workers: results.data
        })
      })
      .catch(error => {
        this.setState({
          isLoading: false,
          needAuth: true
        })
      })
  }

  logout(e) {
    if (document) document.cookie = "token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;Domain=ta.lucis.works;path=/"
  }

  render() {
    if (this.state.isLoading) {
      return (
        <h1>Loading workers...</h1>
      )
    }
    if (this.state.needAuth) {
      return (
        <form action="/email" method="post">
          <div>
            <label for="email">Enter email to verify</label>
            <input name="email" type="email" placeholder="example@thoughtfulautomation.com" />
          </div>
          <button>Submit</button>
        </form>
      )
    }

    console.log('dumping workers:', this.state.workers)

    return (
      <div className="workers">
        <a href="/" onClick={this.logout}>Logout</a>
        {this.state.workers.map((worker, index) =>
          <Worker config={worker} />
        )}
      </div>
    )
  }
}
