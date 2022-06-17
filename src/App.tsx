import "./App.css"

import * as React from "react"

import useConfig from "./components/useConfig"
import logo from "./logo.svg"

import Workers from "./components/Workers"

export default function App() {
  const config = useConfig()
  return (
    <div className="App">
      <Workers />
    </div>
  )
}
