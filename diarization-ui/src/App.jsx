import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { Button } from "@/components/ui/button"
import './App.css'
import MicRecorderComponent from './components/ui/MicRecorder'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <MicRecorderComponent />
    </div>
      
    </>
  )
}

export default App
