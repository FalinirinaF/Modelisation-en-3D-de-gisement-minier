"use client"

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
}

interface PetriNetVisualizationProps {
  places: Map<string, PetriNetPlace>
  transitions: Map<string, PetriNetTransition>
  enabledTransitions: string[]
  onTransitionClick: (transitionId: string) => void
}

export default function PetriNetVisualization({
  places,
  transitions,
  enabledTransitions,
  onTransitionClick,
}: PetriNetVisualizationProps) {
  // Positions améliorées des places et transitions pour le réseau de feux tricolores
  const placePositions = {
    // Ligne Nord (y=80)
    north_red: { x: 120, y: 80 },
    north_yellow: { x: 280, y: 80 },
    north_green: { x: 440, y: 80 },

    // Ligne Sud (y=180)
    south_red: { x: 120, y: 180 },
    south_yellow: { x: 280, y: 180 },
    south_green: { x: 440, y: 180 },

    // Ligne Est (y=280)
    east_red: { x: 120, y: 280 },
    east_yellow: { x: 280, y: 280 },
    east_green: { x: 440, y: 280 },

    // Ligne Ouest (y=380)
    west_red: { x: 120, y: 380 },
    west_yellow: { x: 280, y: 380 },
    west_green: { x: 440, y: 380 },

    // Places de contrôle (centrées)
    phase_ns: { x: 600, y: 130 },
    phase_ew: { x: 600, y: 330 },
  }

  const transitionPositions = {
    // Transitions Nord-Sud
    ns_to_yellow: { x: 350, y: 120 },
    ns_to_red_ew_green: { x: 520, y: 230 },

    // Transitions Est-Ouest
    ew_to_yellow: { x: 350, y: 320 },
    ew_to_red_ns_green: { x: 520, y: 280 },
  }

  // Fonction pour obtenir la couleur d'une place selon son type
  const getPlaceColor = (placeId: string, tokens: number): string => {
    if (tokens === 0) return "#F3F4F6" // Gris très clair

    if (placeId.includes("green")) return "#10B981" // Vert
    if (placeId.includes("yellow")) return "#F59E0B" // Jaune
    if (placeId.includes("red")) return "#EF4444" // Rouge
    if (placeId.includes("phase")) return "#3B82F6" // Bleu pour les phases

    return "#9CA3AF" // Gris par défaut
  }

  // Fonction pour obtenir le nom court d'une place en français
  const getShortName = (placeId: string): string => {
    const parts = placeId.split("_")
    if (parts.length === 2) {
      const direction = parts[0]
      const color = parts[1]

      // Conversion des directions
      let directionCode = ""
      switch (direction) {
        case "north":
          directionCode = "N"
          break
        case "south":
          directionCode = "S"
          break
        case "east":
          directionCode = "E"
          break
        case "west":
          directionCode = "O"
          break // Ouest
        default:
          directionCode = direction.charAt(0).toUpperCase()
      }

      // Conversion des couleurs en français
      let colorCode = ""
      switch (color) {
        case "green":
          colorCode = "V"
          break // Vert
        case "yellow":
          colorCode = "J"
          break // Jaune
        case "red":
          colorCode = "R"
          break // Rouge
        default:
          colorCode = color.charAt(0).toUpperCase()
      }

      return `${directionCode}${colorCode}`
    }

    if (placeId === "phase_ns") return "NS"
    if (placeId === "phase_ew") return "EO"
    return placeId.substring(0, 3).toUpperCase()
  }

  // Fonction pour obtenir le nom complet d'une place
  const getFullName = (placeId: string): string => {
    const parts = placeId.split("_")
    if (parts.length === 2) {
      const direction = parts[0]
      const color = parts[1]

      let directionName = ""
      switch (direction) {
        case "north":
          directionName = "Nord"
          break
        case "south":
          directionName = "Sud"
          break
        case "east":
          directionName = "Est"
          break
        case "west":
          directionName = "Ouest"
          break
        default:
          directionName = direction
      }

      let colorName = ""
      switch (color) {
        case "green":
          colorName = "Vert"
          break
        case "yellow":
          colorName = "Jaune"
          break
        case "red":
          colorName = "Rouge"
          break
        default:
          colorName = color
      }

      return `${directionName} ${colorName}`
    }

    if (placeId === "phase_ns") return "Phase Nord-Sud"
    if (placeId === "phase_ew") return "Phase Est-Ouest"
    return placeId
  }

  // Fonction pour dessiner une flèche améliorée
  const drawArrow = (x1: number, y1: number, x2: number, y2: number, id: string, isEnabled = false) => {
    const strokeColor = isEnabled ? "#059669" : "#6B7280"
    const strokeWidth = isEnabled ? "3" : "2"

    return (
      <g key={id}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          markerEnd={`url(#arrowhead-${isEnabled ? "enabled" : "disabled"})`}
          opacity={isEnabled ? 1 : 0.7}
        />
      </g>
    )
  }

  return (
    <div className="w-full overflow-x-auto bg-gray-50 p-4 rounded-lg">
      <div className="min-w-[800px]">
        <svg width="800" height="500" className="border-2 border-gray-200 rounded-lg bg-white shadow-sm">
          {/* Définition des marqueurs pour les flèches */}
          <defs>
            <marker id="arrowhead-enabled" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0, 12 4, 0 8" fill="#059669" />
            </marker>
            <marker id="arrowhead-disabled" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0, 12 4, 0 8" fill="#6B7280" />
            </marker>

            {/* Filtres pour les ombres */}
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="#00000020" />
            </filter>
          </defs>

          {/* Fond avec grille subtile */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#F3F4F6" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Groupes visuels pour organiser les directions */}
          <g>
            {/* Groupe Nord */}
            <rect
              x="100"
              y="60"
              width="360"
              height="60"
              fill="#EFF6FF"
              stroke="#DBEAFE"
              strokeWidth="1"
              rx="8"
              opacity="0.5"
            />
            <text x="110" y="50" className="text-sm font-semibold fill-blue-700">
              NORD
            </text>

            {/* Groupe Sud */}
            <rect
              x="100"
              y="160"
              width="360"
              height="60"
              fill="#F0FDF4"
              stroke="#DCFCE7"
              strokeWidth="1"
              rx="8"
              opacity="0.5"
            />
            <text x="110" y="150" className="text-sm font-semibold fill-green-700">
              SUD
            </text>

            {/* Groupe Est */}
            <rect
              x="100"
              y="260"
              width="360"
              height="60"
              fill="#FEF3C7"
              stroke="#FDE68A"
              strokeWidth="1"
              rx="8"
              opacity="0.5"
            />
            <text x="110" y="250" className="text-sm font-semibold fill-yellow-700">
              EST
            </text>

            {/* Groupe Ouest */}
            <rect
              x="100"
              y="360"
              width="360"
              height="60"
              fill="#FDF2F8"
              stroke="#FCE7F3"
              strokeWidth="1"
              rx="8"
              opacity="0.5"
            />
            <text x="110" y="350" className="text-sm font-semibold fill-pink-700">
              OUEST
            </text>

            {/* Groupe Contrôle */}
            <rect
              x="580"
              y="110"
              width="80"
              height="280"
              fill="#F8FAFC"
              stroke="#E2E8F0"
              strokeWidth="1"
              rx="8"
              opacity="0.5"
            />
            <text x="590" y="100" className="text-sm font-semibold fill-slate-700">
              CONTRÔLE
            </text>
          </g>

          {/* Dessiner les connexions */}
          {Array.from(transitions.values()).map((transition) => {
            const transPos = transitionPositions[transition.id as keyof typeof transitionPositions]
            if (!transPos) return null

            const isTransitionEnabled = enabledTransitions.includes(transition.id)

            return (
              <g key={`connections-${transition.id}`}>
                {/* Flèches des places d'entrée vers la transition */}
                {transition.inputPlaces.map((input, index) => {
                  const placePos = placePositions[input.placeId as keyof typeof placePositions]
                  if (!placePos) return null

                  return drawArrow(
                    placePos.x + 25,
                    placePos.y + 25,
                    transPos.x + 5,
                    transPos.y + 15,
                    `input-${transition.id}-${index}`,
                    isTransitionEnabled,
                  )
                })}

                {/* Flèches de la transition vers les places de sortie */}
                {transition.outputPlaces.map((output, index) => {
                  const placePos = placePositions[output.placeId as keyof typeof placePositions]
                  if (!placePos) return null

                  return drawArrow(
                    transPos.x + 45,
                    transPos.y + 15,
                    placePos.x,
                    placePos.y + 25,
                    `output-${transition.id}-${index}`,
                    isTransitionEnabled,
                  )
                })}
              </g>
            )
          })}

          {/* Dessiner les places */}
          {Array.from(places.entries()).map(([placeId, place]) => {
            const pos = placePositions[placeId as keyof typeof placePositions]
            if (!pos) return null

            const hasTokens = place.tokens > 0
            const placeColor = getPlaceColor(placeId, place.tokens)

            return (
              <g key={placeId}>
                {/* Ombre de la place */}
                <circle cx={pos.x + 27} cy={pos.y + 27} r="25" fill="#00000010" />

                {/* Cercle de la place */}
                <circle
                  cx={pos.x + 25}
                  cy={pos.y + 25}
                  r="25"
                  fill={placeColor}
                  stroke={hasTokens ? "#374151" : "#9CA3AF"}
                  strokeWidth={hasTokens ? "3" : "2"}
                  filter="url(#shadow)"
                />

                {/* Token (point noir) si la place contient des tokens */}
                {hasTokens && (
                  <circle cx={pos.x + 25} cy={pos.y + 25} r="8" fill="#1F2937" stroke="#FFFFFF" strokeWidth="2" />
                )}

                {/* Nom court de la place */}
                <text x={pos.x + 25} y={pos.y + 65} textAnchor="middle" className="text-sm font-bold fill-gray-800">
                  {getShortName(placeId)}
                </text>

                {/* Tooltip avec nom complet */}
                <title>
                  {getFullName(placeId)} ({place.tokens} token{place.tokens !== 1 ? "s" : ""})
                </title>
              </g>
            )
          })}

          {/* Dessiner les transitions */}
          {Array.from(transitions.entries()).map(([transitionId, transition]) => {
            const pos = transitionPositions[transitionId as keyof typeof transitionPositions]
            if (!pos) return null

            const isEnabled = enabledTransitions.includes(transitionId)

            return (
              <g key={transitionId}>
                {/* Ombre de la transition */}
                <rect x={pos.x + 2} y={pos.y + 2} width="50" height="30" fill="#00000015" rx="4" />

                {/* Rectangle de la transition */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width="50"
                  height="30"
                  fill={isEnabled ? "#059669" : "#9CA3AF"}
                  stroke={isEnabled ? "#047857" : "#6B7280"}
                  strokeWidth="2"
                  rx="4"
                  className="cursor-pointer transition-all duration-200 hover:opacity-80"
                  onClick={() => onTransitionClick(transitionId)}
                  filter="url(#shadow)"
                />

                {/* Indicateur d'état de la transition */}
                {isEnabled && (
                  <circle cx={pos.x + 45} cy={pos.y + 5} r="3" fill="#10B981" stroke="#FFFFFF" strokeWidth="1" />
                )}

                {/* Nom de la transition */}
                <text x={pos.x + 25} y={pos.y + 45} textAnchor="middle" className="text-xs font-medium fill-gray-700">
                  {transition.name}
                </text>

                {/* Tooltip */}
                <title>
                  {transition.name} - {isEnabled ? "Activée (cliquez pour exécuter)" : "Désactivée"}
                </title>
              </g>
            )
          })}
        </svg>

        {/* Légende améliorée */}
        <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Légende</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-400"></div>
              <span>Place vide</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-gray-800 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gray-800 border border-white"></div>
                </div>
              </div>
              <span>Place avec token</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 bg-green-600 border-2 border-green-800 rounded"></div>
              <span>Transition activée</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 bg-gray-500 border-2 border-gray-600 rounded"></div>
              <span>Transition désactivée</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600">
              <strong>Abréviations:</strong> N=Nord, S=Sud, E=Est, O=Ouest | V=Vert, J=Jaune, R=Rouge
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
