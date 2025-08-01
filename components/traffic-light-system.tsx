"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import PetriNetVisualization from "@/components/petri-net-visualization"
import { Play, Pause, RotateCcw, Brain, Activity, Car, Zap, Settings, ArrowRight } from "lucide-react"

// Helper function to translate light states
const translateLightState = (state: string): string => {
  switch (state) {
    case "green":
      return "VERT"
    case "yellow":
      return "JAUNE"
    case "red":
      return "ROUGE"
    default:
      return "INCONNU"
  }
}

// Helper function to translate directions
const translateDirection = (direction: string): string => {
  switch (direction) {
    case "north":
      return "NORD"
    case "south":
      return "SUD"
    case "east":
      return "EST"
    case "west":
      return "OUEST"
    default:
      return direction.toUpperCase()
  }
}

// Types pour le système
interface PetriNetPlace {
  id: string
  tokens: number
  capacity: number
  name: string
}

interface PetriNetTransition {
  id: string
  name: string
  enabled: boolean
  inputPlaces: { placeId: string; weight: number }[]
  outputPlaces: { placeId: string; weight: number }[]
  condition?: () => boolean
}

interface TrafficData {
  direction: "north" | "south" | "east" | "west"
  vehicleCount: number
  waitTime: number
  timestamp: number
}

interface QLearningState {
  northQueue: number
  southQueue: number
  eastQueue: number
  westQueue: number
  currentPhase: number
}

// Réseau de Petri pour les feux tricolores
class TrafficLightPetriNet {
  places: Map<string, PetriNetPlace> = new Map()
  transitions: Map<string, PetriNetTransition> = new Map()
  transitionHistory: { transitionId: string; timestamp: number; success: boolean }[] = []

  constructor() {
    this.initializePetriNet()
  }

  initializePetriNet() {
    // Places pour chaque direction et couleur
    const directions = ["north", "south", "east", "west"]
    const colors = ["red", "yellow", "green"]

    directions.forEach((dir) => {
      colors.forEach((color) => {
        // Initialiser Nord et Sud en vert, Est et Ouest en rouge
        let initialTokens = 0
        if ((dir === "north" || dir === "south") && color === "green") {
          initialTokens = 1
        } else if ((dir === "east" || dir === "west") && color === "red") {
          initialTokens = 1
        }

        this.places.set(`${dir}_${color}`, {
          id: `${dir}_${color}`,
          tokens: initialTokens,
          capacity: 1,
          name: `${translateDirection(dir)} ${translateLightState(color)}`,
        })
      })
    })

    // Places de contrôle pour les phases
    this.places.set("phase_ns", { id: "phase_ns", tokens: 1, capacity: 1, name: "Phase Nord-Sud" })
    this.places.set("phase_ew", { id: "phase_ew", tokens: 0, capacity: 1, name: "Phase Est-Ouest" })

    // Transitions pour les changements d'état
    this.initializeTransitions()
  }

  initializeTransitions() {
    // Transitions Nord-Sud : Vert → Jaune
    this.transitions.set("ns_to_yellow", {
      id: "ns_to_yellow",
      name: "NS vers Jaune",
      enabled: false,
      inputPlaces: [
        { placeId: "north_green", weight: 1 },
        { placeId: "south_green", weight: 1 },
        { placeId: "phase_ns", weight: 1 },
      ],
      outputPlaces: [
        { placeId: "north_yellow", weight: 1 },
        { placeId: "south_yellow", weight: 1 },
        { placeId: "phase_ns", weight: 1 },
      ],
    })

    // Transitions Nord-Sud : Jaune → Rouge + EW Vert
    this.transitions.set("ns_to_red_ew_green", {
      id: "ns_to_red_ew_green",
      name: "NS Rouge + EW Vert",
      enabled: false,
      inputPlaces: [
        { placeId: "north_yellow", weight: 1 },
        { placeId: "south_yellow", weight: 1 },
        { placeId: "east_red", weight: 1 },
        { placeId: "west_red", weight: 1 },
        { placeId: "phase_ns", weight: 1 },
      ],
      outputPlaces: [
        { placeId: "north_red", weight: 1 },
        { placeId: "south_red", weight: 1 },
        { placeId: "east_green", weight: 1 },
        { placeId: "west_green", weight: 1 },
        { placeId: "phase_ew", weight: 1 },
      ],
    })

    // Transitions Est-Ouest : Vert → Jaune
    this.transitions.set("ew_to_yellow", {
      id: "ew_to_yellow",
      name: "EW vers Jaune",
      enabled: false,
      inputPlaces: [
        { placeId: "east_green", weight: 1 },
        { placeId: "west_green", weight: 1 },
        { placeId: "phase_ew", weight: 1 },
      ],
      outputPlaces: [
        { placeId: "east_yellow", weight: 1 },
        { placeId: "west_yellow", weight: 1 },
        { placeId: "phase_ew", weight: 1 },
      ],
    })

    // Transitions Est-Ouest : Jaune → Rouge + NS Vert
    this.transitions.set("ew_to_red_ns_green", {
      id: "ew_to_red_ns_green",
      name: "EW Rouge + NS Vert",
      enabled: false,
      inputPlaces: [
        { placeId: "east_yellow", weight: 1 },
        { placeId: "west_yellow", weight: 1 },
        { placeId: "north_red", weight: 1 },
        { placeId: "south_red", weight: 1 },
        { placeId: "phase_ew", weight: 1 },
      ],
      outputPlaces: [
        { placeId: "east_red", weight: 1 },
        { placeId: "west_red", weight: 1 },
        { placeId: "north_green", weight: 1 },
        { placeId: "south_green", weight: 1 },
        { placeId: "phase_ns", weight: 1 },
      ],
    })
  }

  isTransitionEnabled(transitionId: string): boolean {
    const transition = this.transitions.get(transitionId)
    if (!transition) return false

    return transition.inputPlaces.every((input) => {
      const place = this.places.get(input.placeId)
      return place && place.tokens >= input.weight
    })
  }

  fireTransition(transitionId: string): boolean {
    if (!this.isTransitionEnabled(transitionId)) {
      this.transitionHistory.push({
        transitionId,
        timestamp: Date.now(),
        success: false,
      })
      return false
    }

    const transition = this.transitions.get(transitionId)!

    // Retirer les tokens des places d'entrée
    transition.inputPlaces.forEach((input) => {
      const place = this.places.get(input.placeId)!
      place.tokens -= input.weight
    })

    // Ajouter les tokens aux places de sortie
    transition.outputPlaces.forEach((output) => {
      const place = this.places.get(output.placeId)!
      place.tokens = Math.min(place.tokens + output.weight, place.capacity)
    })

    this.transitionHistory.push({
      transitionId,
      timestamp: Date.now(),
      success: true,
    })

    return true
  }

  getCurrentLightState(direction: string): string {
    if (this.places.get(`${direction}_green`)?.tokens === 1) return "green"
    if (this.places.get(`${direction}_yellow`)?.tokens === 1) return "yellow"
    return "red"
  }

  getCurrentPhase(): "ns" | "ew" {
    return this.places.get("phase_ns")?.tokens === 1 ? "ns" : "ew"
  }

  getEnabledTransitions(): string[] {
    return Array.from(this.transitions.keys()).filter((id) => this.isTransitionEnabled(id))
  }

  getTransitionHistory(): { transitionId: string; timestamp: number; success: boolean }[] {
    return this.transitionHistory.slice(-10) // Dernières 10 transitions
  }

  // Méthode pour ajouter/retirer manuellement des tokens (pour le contrôle manuel)
  setTokens(placeId: string, tokens: number): boolean {
    const place = this.places.get(placeId)
    if (!place) return false

    place.tokens = Math.max(0, Math.min(tokens, place.capacity))
    return true
  }

  // Réinitialiser l'historique
  clearHistory() {
    this.transitionHistory = []
  }
}

// Agent Q-Learning pour l'optimisation
class QLearningAgent {
  qTable: Map<string, Map<string, number>> = new Map()
  learningRate = 0.1
  discountFactor = 0.95
  explorationRate = 0.1

  getStateKey(state: QLearningState): string {
    return `${state.northQueue}-${state.southQueue}-${state.eastQueue}-${state.westQueue}-${state.currentPhase}`
  }

  getQValue(state: QLearningState, action: string): number {
    const stateKey = this.getStateKey(state)
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map())
    }
    return this.qTable.get(stateKey)!.get(action) || 0
  }

  setQValue(state: QLearningState, action: string, value: number) {
    const stateKey = this.getStateKey(state)
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map())
    }
    this.qTable.get(stateKey)!.set(action, value)
  }

  chooseAction(state: QLearningState, availableActions: string[]): string {
    if (Math.random() < this.explorationRate) {
      return availableActions[Math.floor(Math.random() * availableActions.length)]
    }

    let bestAction = availableActions[0]
    let bestValue = this.getQValue(state, bestAction)

    for (const action of availableActions) {
      const value = this.getQValue(state, action)
      if (value > bestValue) {
        bestValue = value
        bestAction = action
      }
    }

    return bestAction
  }

  updateQValue(state: QLearningState, action: string, reward: number, nextState: QLearningState) {
    const currentQ = this.getQValue(state, action)
    const availableActions = ["extend_current", "switch_phase"]
    const maxNextQ = Math.max(...availableActions.map((a) => this.getQValue(nextState, a)))

    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ)
    this.setQValue(state, action, newQ)
  }

  calculateReward(trafficData: TrafficData[]): number {
    const totalWaitTime = trafficData.reduce((sum, data) => sum + data.waitTime, 0)
    const totalVehicles = trafficData.reduce((sum, data) => sum + data.vehicleCount, 0)

    // Récompense négative basée sur le temps d'attente moyen
    return totalVehicles > 0 ? -totalWaitTime / totalVehicles : 0
  }
}

// Simulateur de trafic
class TrafficSimulator {
  trafficData: Map<string, TrafficData> = new Map()
  getCurrentLightState: ((direction: string) => string) | undefined

  constructor() {
    this.initializeTrafficData()
  }

  initializeTrafficData() {
    const directions = ["north", "south", "east", "west"] as const
    directions.forEach((dir) => {
      this.trafficData.set(dir, {
        direction: dir,
        vehicleCount: Math.floor(Math.random() * 20) + 5,
        waitTime: 0,
        timestamp: Date.now(),
      })
    })
  }

  updateTrafficData(currentPhase: "ns" | "ew", phaseDuration: number) {
    const directions = ["north", "south", "east", "west"] as const

    directions.forEach((dir) => {
      const data = this.trafficData.get(dir)!
      const currentLightState = this.getCurrentLightState ? this.getCurrentLightState(dir) : "red"

      // Simuler l'arrivée de nouveaux véhicules (plus contrôlée)
      if (Math.random() < 0.2) {
        data.vehicleCount += Math.floor(Math.random() * 2) + 1
      }

      // Vérifier si le feu est vraiment vert pour cette direction
      const isActuallyGreen = currentLightState === "green"

      if (isActuallyGreen && data.vehicleCount > 0) {
        // Plus de véhicules passent quand c'est vert
        const vehiclesPassing = Math.min(data.vehicleCount, Math.floor(Math.random() * 4) + 3)
        data.vehicleCount = Math.max(0, data.vehicleCount - vehiclesPassing)
        data.waitTime = Math.max(0, data.waitTime - 2)
      } else if (!isActuallyGreen && data.vehicleCount > 0) {
        // Augmenter le temps d'attente si ce n'est pas vert
        data.waitTime += 1
      }

      // Limiter le nombre maximum de véhicules
      data.vehicleCount = Math.min(data.vehicleCount, 25)
      data.timestamp = Date.now()
    })
  }

  getTrafficData(): TrafficData[] {
    return Array.from(this.trafficData.values())
  }

  setLightStateChecker(checker: (direction: string) => string) {
    this.getCurrentLightState = checker
  }
}

export default function TrafficLightSystem() {
  const [petriNet] = useState(() => new TrafficLightPetriNet())
  const [qAgent] = useState(() => new QLearningAgent())
  const [simulator] = useState(() => new TrafficSimulator())

  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [phaseDuration, setPhaseDuration] = useState([30])
  const [yellowDuration] = useState(3)
  const [manualMode, setManualMode] = useState(false)
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null)
  const [metrics, setMetrics] = useState({
    totalWaitTime: 0,
    averageWaitTime: 0,
    totalVehicles: 0,
    episodeReward: 0,
  })

  const intervalRef = useRef<NodeJS.Timeout>()
  const phaseTimerRef = useRef(0)
  const currentTransitionRef = useRef<string | null>(null)

  const getCurrentState = useCallback((): QLearningState => {
    const trafficData = simulator.getTrafficData()
    return {
      northQueue: trafficData.find((d) => d.direction === "north")?.vehicleCount || 0,
      southQueue: trafficData.find((d) => d.direction === "south")?.vehicleCount || 0,
      eastQueue: trafficData.find((d) => d.direction === "east")?.vehicleCount || 0,
      westQueue: trafficData.find((d) => d.direction === "west")?.vehicleCount || 0,
      currentPhase: petriNet.getCurrentPhase() === "ns" ? 0 : 1,
    }
  }, [petriNet, simulator])

  const executeTransition = useCallback(
    (transitionId: string) => {
      if (petriNet.fireTransition(transitionId)) {
        currentTransitionRef.current = transitionId
        return true
      }
      return false
    },
    [petriNet],
  )

  const getNextTransition = useCallback((): string | null => {
    const currentPhase = petriNet.getCurrentPhase()
    const northState = petriNet.getCurrentLightState("north")
    const eastState = petriNet.getCurrentLightState("east")

    // Séquence pour Nord-Sud
    if (currentPhase === "ns") {
      if (northState === "green") return "ns_to_yellow"
      if (northState === "yellow") return "ns_to_red_ew_green"
    }

    // Séquence pour Est-Ouest
    if (currentPhase === "ew") {
      if (eastState === "green") return "ew_to_yellow"
      if (eastState === "yellow") return "ew_to_red_ns_green"
    }

    return null
  }, [petriNet])

  const simulationStep = useCallback(() => {
    if (manualMode) return // Ne pas exécuter automatiquement en mode manuel

    const currentState = getCurrentState()
    const trafficData = simulator.getTrafficData()

    // Mettre à jour le timer de phase
    phaseTimerRef.current += 1

    // Logique avec phase jaune
    const currentPhase = petriNet.getCurrentPhase()
    const currentLightState = petriNet.getCurrentLightState(currentPhase === "ns" ? "north" : "east")

    let shouldSwitch = false

    // Changer de vert vers jaune après 30s
    if (currentLightState === "green" && phaseTimerRef.current >= phaseDuration[0]) {
      shouldSwitch = true
    }
    // Changer de jaune vers rouge (+ autre direction vert) après 3s
    else if (currentLightState === "yellow" && phaseTimerRef.current >= yellowDuration) {
      shouldSwitch = true
    }

    // Exécuter la transition si nécessaire
    if (shouldSwitch) {
      const nextTransition = getNextTransition()
      if (nextTransition) {
        if (executeTransition(nextTransition)) {
          phaseTimerRef.current = 0 // Réinitialiser le timer

          // Calculer la récompense et mettre à jour Q-learning
          const reward = qAgent.calculateReward(trafficData)
          const nextState = getCurrentState()
          qAgent.updateQValue(currentState, "switch_phase", reward, nextState)
        }
      }
    }

    // Mettre à jour les données de trafic
    simulator.updateTrafficData(petriNet.getCurrentPhase(), 1)

    // Calculer les métriques
    const totalWaitTime = trafficData.reduce((sum, data) => sum + data.waitTime, 0)
    const totalVehicles = trafficData.reduce((sum, data) => sum + data.vehicleCount, 0)
    const averageWaitTime = totalVehicles > 0 ? totalWaitTime / totalVehicles : 0

    setMetrics({
      totalWaitTime,
      averageWaitTime,
      totalVehicles,
      episodeReward: qAgent.calculateReward(trafficData),
    })

    setCurrentStep((prev) => prev + 1)
  }, [
    manualMode,
    getCurrentState,
    simulator,
    petriNet,
    qAgent,
    phaseDuration,
    yellowDuration,
    executeTransition,
    getNextTransition,
  ])

  const startSimulation = useCallback(() => {
    if (!isRunning) {
      setIsRunning(true)
      intervalRef.current = setInterval(simulationStep, 1000)
    }
  }, [isRunning, simulationStep])

  const stopSimulation = useCallback(() => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [])

  const resetSimulation = useCallback(() => {
    stopSimulation()
    petriNet.initializePetriNet()
    petriNet.clearHistory()
    simulator.initializeTrafficData()
    setCurrentStep(0)
    phaseTimerRef.current = 0
    setSelectedTransition(null)
    setMetrics({
      totalWaitTime: 0,
      averageWaitTime: 0,
      totalVehicles: 0,
      episodeReward: 0,
    })
  }, [stopSimulation, petriNet, simulator])

  // Fonction pour exécuter manuellement une transition
  const executeManualTransition = useCallback(
    (transitionId: string) => {
      const success = executeTransition(transitionId)
      if (success) {
        phaseTimerRef.current = 0
        // Mettre à jour les données de trafic après la transition manuelle
        simulator.updateTrafficData(petriNet.getCurrentPhase(), 1)

        // Calculer les nouvelles métriques
        const trafficData = simulator.getTrafficData()
        const totalWaitTime = trafficData.reduce((sum, data) => sum + data.waitTime, 0)
        const totalVehicles = trafficData.reduce((sum, data) => sum + data.vehicleCount, 0)
        const averageWaitTime = totalVehicles > 0 ? totalWaitTime / totalVehicles : 0

        setMetrics({
          totalWaitTime,
          averageWaitTime,
          totalVehicles,
          episodeReward: qAgent.calculateReward(trafficData),
        })
      }
      return success
    },
    [executeTransition, simulator, petriNet, qAgent],
  )

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const getLightColor = (direction: string): string => {
    const state = petriNet.getCurrentLightState(direction)
    switch (state) {
      case "green":
        return "#10B981"
      case "yellow":
        return "#F59E0B"
      case "red":
        return "#EF4444"
      default:
        return "#6B7280"
    }
  }

  const trafficData = simulator.getTrafficData()
  const enabledTransitions = petriNet.getEnabledTransitions()
  const transitionHistory = petriNet.getTransitionHistory()

  useEffect(() => {
    simulator.setLightStateChecker((direction: string) => petriNet.getCurrentLightState(direction))
  }, [simulator, petriNet])

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Système Intelligent de Gestion de Feux Tricolores</h1>
        <p className="text-muted-foreground">Combinaison de Réseau de Petri et Machine Learning avec Q-Learning</p>
      </div>

      {/* Contrôles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Contrôles de Simulation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button onClick={startSimulation} disabled={isRunning || manualMode} className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Démarrer
            </Button>
            <Button
              onClick={stopSimulation}
              disabled={!isRunning}
              variant="outline"
              className="flex items-center gap-2 bg-transparent"
            >
              <Pause className="w-4 h-4" />
              Arrêter
            </Button>
            <Button onClick={resetSimulation} variant="outline" className="flex items-center gap-2 bg-transparent">
              <RotateCcw className="w-4 h-4" />
              Réinitialiser
            </Button>
            <Button
              onClick={() => setManualMode(!manualMode)}
              variant={manualMode ? "default" : "outline"}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {manualMode ? "Mode Manuel" : "Mode Auto"}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Durée Phase Verte (secondes): {phaseDuration[0]}</label>
            <Slider
              value={phaseDuration}
              onValueChange={setPhaseDuration}
              min={10}
              max={60}
              step={5}
              className="w-full"
              disabled={manualMode}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Étape:</span> {currentStep}
            </div>
            <div>
              <span className="font-medium">Phase:</span>{" "}
              {petriNet.getCurrentPhase() === "ns" ? "NORD-SUD" : "EST-OUEST"}
            </div>
            <div>
              <span className="font-medium">Minuteur:</span> {phaseTimerRef.current}s
            </div>
            <div>
              <span className="font-medium">Mode:</span> {manualMode ? "Manuel" : "Automatique"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualisation du Réseau de Petri */}
      {manualMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Réseau de Petri - Feux Tricolores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PetriNetVisualization
              places={petriNet.places}
              transitions={petriNet.transitions}
              enabledTransitions={enabledTransitions}
              onTransitionClick={executeManualTransition}
            />
          </CardContent>
        </Card>
      )}

      {/* Flux de Commande du Réseau de Petri */}
      {manualMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Contrôles et Historique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Transitions Disponibles */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Transitions Disponibles</h3>
                <div className="space-y-2">
                  {Array.from(petriNet.transitions.values()).map((transition) => {
                    const isEnabled = enabledTransitions.includes(transition.id)
                    return (
                      <div key={transition.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={isEnabled ? "default" : "secondary"}>
                            {isEnabled ? "ACTIVÉE" : "DÉSACTIVÉE"}
                          </Badge>
                          <span className="font-medium">{transition.name}</span>
                        </div>
                        <Button
                          size="sm"
                          disabled={!isEnabled}
                          onClick={() => executeManualTransition(transition.id)}
                          className="flex items-center gap-1"
                        >
                          <ArrowRight className="w-3 h-3" />
                          Exécuter
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Historique des Transitions */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Historique des Transitions</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transitionHistory.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Aucune transition exécutée</p>
                  ) : (
                    transitionHistory.reverse().map((entry, index) => {
                      const transition = petriNet.transitions.get(entry.transitionId)
                      const timeAgo = Math.floor((Date.now() - entry.timestamp) / 1000)
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant={entry.success ? "default" : "destructive"} className="text-xs">
                              {entry.success ? "✓" : "✗"}
                            </Badge>
                            <span className="text-sm font-medium">{transition?.name || entry.transitionId}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">il y a {timeAgo}s</span>
                        </div>
                      )
                    })
                  )}
                </div>
                {transitionHistory.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => petriNet.clearHistory()} className="w-full">
                    Effacer l'historique
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visualisation du carrefour */}
      <Card>
        <CardHeader>
          <CardTitle>Carrefour à Quatre Voies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full max-w-md mx-auto aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {/* Routes */}
            <div className="absolute inset-0">
              {/* Route horizontale */}
              <div className="absolute top-1/2 left-0 right-0 h-20 bg-gray-600 transform -translate-y-1/2"></div>
              {/* Route verticale */}
              <div className="absolute left-1/2 top-0 bottom-0 w-20 bg-gray-600 transform -translate-x-1/2"></div>
              {/* Intersection */}
              <div className="absolute top-1/2 left-1/2 w-20 h-20 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Feux de signalisation avec debug */}
            {/* Nord */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-1">
              <div
                className="w-6 h-6 rounded-full border-2 border-gray-800"
                style={{ backgroundColor: getLightColor("north") }}
              ></div>
              <div className="text-xs text-center font-bold">N</div>
              <div className="text-xs text-center">{translateLightState(petriNet.getCurrentLightState("north"))}</div>
            </div>

            {/* Sud */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-1">
              <div className="text-xs text-center">{translateLightState(petriNet.getCurrentLightState("south"))}</div>
              <div className="text-xs text-center font-bold">S</div>
              <div
                className="w-6 h-6 rounded-full border-2 border-gray-800"
                style={{ backgroundColor: getLightColor("south") }}
              ></div>
            </div>

            {/* Est */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <div className="text-xs font-bold">E</div>
              <div
                className="w-6 h-6 rounded-full border-2 border-gray-800"
                style={{ backgroundColor: getLightColor("east") }}
              ></div>
              <div className="text-xs">{translateLightState(petriNet.getCurrentLightState("east"))}</div>
            </div>

            {/* Ouest */}
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <div className="text-xs">{translateLightState(petriNet.getCurrentLightState("west"))}</div>
              <div
                className="w-6 h-6 rounded-full border-2 border-gray-800"
                style={{ backgroundColor: getLightColor("west") }}
              ></div>
              <div className="text-xs font-bold">O</div>
            </div>

            {/* Véhicules en attente */}
            {trafficData.map((data) => {
              const count = Math.min(data.vehicleCount, 8)
              const vehicles = Array.from({ length: count }, (_, i) => i)

              return vehicles.map((i) => {
                let style = {}
                switch (data.direction) {
                  case "north":
                    style = {
                      bottom: `${60 + i * 8}%`,
                      left: "47%",
                      transform: "rotate(0deg)",
                    }
                    break
                  case "south":
                    style = {
                      top: `${60 + i * 8}%`,
                      left: "53%",
                      transform: "rotate(180deg)",
                    }
                    break
                  case "east":
                    style = {
                      left: `${60 + i * 8}%`,
                      top: "47%",
                      transform: "rotate(90deg)",
                    }
                    break
                  case "west":
                    style = {
                      right: `${60 + i * 8}%`,
                      top: "53%",
                      transform: "rotate(-90deg)",
                    }
                    break
                }

                return <Car key={`${data.direction}-${i}`} className="absolute w-3 h-3 text-blue-600" style={style} />
              })
            })}
          </div>
        </CardContent>
      </Card>

      {/* Données de trafic et métriques */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Données de Trafic en Temps Réel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trafficData.map((data) => (
                <div key={data.direction} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{translateDirection(data.direction)}</Badge>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getLightColor(data.direction) }}
                    ></div>
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      <span className="font-medium">Véhicules:</span> {data.vehicleCount}
                    </div>
                    <div>
                      <span className="font-medium">Attente:</span> {data.waitTime.toFixed(1)}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Métriques d'Optimisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Temps d'Attente Total</div>
                  <div className="text-2xl font-bold text-blue-800">{metrics.totalWaitTime.toFixed(1)}s</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Temps d'Attente Moyen</div>
                  <div className="text-2xl font-bold text-green-800">{metrics.averageWaitTime.toFixed(1)}s</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">Véhicules Totaux</div>
                  <div className="text-2xl font-bold text-purple-800">{metrics.totalVehicles}</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm text-orange-600 font-medium">Récompense RL</div>
                  <div className="text-2xl font-bold text-orange-800">{metrics.episodeReward.toFixed(2)}</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>
                  <strong>Q-Learning:</strong> L'agent apprend à optimiser les durées des feux pour minimiser le temps
                  d'attente.
                </p>
                <p>
                  <strong>Réseau de Petri:</strong> Modélise les transitions d'états des feux de signalisation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* État du Réseau de Petri */}
      <Card>
        <CardHeader>
          <CardTitle>État du Réseau de Petri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from(petriNet.places.entries()).map(([id, place]) => (
              <div key={id} className="p-3 border rounded-lg">
                <div className="text-sm font-medium">{place.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-lg font-bold">{place.tokens}</div>
                  <div className="w-3 h-3 rounded-full bg-gray-300">
                    {place.tokens > 0 && <div className="w-full h-full rounded-full bg-blue-500"></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
