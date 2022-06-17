import * as React from "react"
import axios from "axios"
import _ from "lodash"

export default class Worker extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isLoading: true,
      data: undefined
    }
  }

  componentDidMount() {
    this.callApi()
  }

  callApi() {
    console.log("calling API:", this.props.config.api)
    axios.get(this.props.config.api)
      .then(results => {
        console.log("dumping results:", results)
        console.log("dumping mapping:", this.props.config.mapping)
        this.setState({
          isLoading: false,
          data: _.get(results.data, this.props.config.mapping)
        })
      })
  }
  render() {
    if (this.state.isLoading) {
      return (
        <h1>Loading API...</h1>
      )
    }
    console.log("dumping data:", this.state.data)

    return (
      <div class="api">
        <h1 class="name">{this.props.config.name}</h1>
        <p class="description">{this.props.config.description}</p>
        <p class="data">{this.state.data}</p>
      </div>
    )
  }
}
