import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, type } = await req.json()
    console.log(`Searching for ${query} with type ${type}`)

    // Mock search logic for Trust Grapher
    const mockData = {
      score: Math.floor(Math.random() * 100),
      status: "COMPLETED",
      findings: [
        { id: 1, type: "CPF", value: query, risk: "low" },
        { id: 2, type: "Address", value: "Rua das Flores, 123", risk: "medium" }
      ]
    }

    return new Response(
      JSON.stringify(mockData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
