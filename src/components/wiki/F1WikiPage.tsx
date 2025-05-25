
"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, History, Car, Flag, Users, Trophy, MapPin, Search, Loader2 } from 'lucide-react';
import { queryF1Expert, type F1QueryInput, type F1QueryOutput } from "@/ai/flows/f1-query-flow";

interface WikiSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

// Helper function to convert simple Markdown bold to HTML strong tags
function formatAIResponse(text: string): string {
  // Replace *bold* with <strong>bold</strong>
  // This regex handles asterisks that are not part of other words
  // and ensures there are non-space characters inside the asterisks.
  let formattedText = text.replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<strong>$1</strong>');
  return formattedText;
}


const wikiSections: WikiSection[] = [
  {
    id: "history",
    title: "A Brief History of Formula 1",
    icon: <History className="h-5 w-5 mr-2" />,
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Formula 1, officially the FIA Formula One World Championship, is the highest class of international single-seater auto racing sanctioned by the Fédération Internationale de l'Automobile (FIA).
          The inaugural World Championship race was held in 1950 at Silverstone, UK.
        </p>
        <p>
          Over the decades, F1 has evolved dramatically, from its post-war origins with front-engined cars to today's technologically advanced hybrid power units and sophisticated aerodynamics.
          It has seen eras dominated by legendary drivers like Juan Manuel Fangio, Jim Clark, Jackie Stewart, Niki Lauda, Alain Prost, Ayrton Senna, Michael Schumacher, and Lewis Hamilton, and iconic teams such as Ferrari, McLaren, Williams, Lotus, and Mercedes.
        </p>
        <p>
          Key technological shifts include the introduction of mid-engined cars, ground effect aerodynamics, turbochargers, active suspension, carbon fibre construction, and complex energy recovery systems. Safety has also been a paramount concern, with continuous improvements in car design, track safety, and driver equipment.
        </p>
      </div>
    ),
  },
  {
    id: "cars-tech",
    title: "F1 Cars & Technology",
    icon: <Car className="h-5 w-5 mr-2" />,
    content: (
      <div className="space-y-4 text-muted-foreground">
        <div>
          <h4 className="font-semibold text-foreground mb-1">Power Units:</h4>
          <p>
            Modern F1 cars use highly complex 1.6-liter V6 turbocharged hybrid power units. These combine an internal combustion engine (ICE) with Energy Recovery Systems (ERS) – the MGU-K (Motor Generator Unit – Kinetic) and MGU-H (Motor Generator Unit – Heat). These systems recover energy from braking and exhaust heat, respectively, storing it in a battery and deploying it for extra power.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Aerodynamics:</h4>
          <p>
            Aerodynamics are critical in F1, generating enormous amounts of downforce to push the car onto the track, allowing for incredible cornering speeds. Key components include the front and rear wings, the floor (utilizing ground effect principles), bargeboards, and various other winglets and diffusers. The Drag Reduction System (DRS) is an adjustable rear wing flap that reduces drag on straights to aid overtaking.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Tires:</h4>
          <p>
            Pirelli is the current sole tire supplier. They provide a range of slick (dry weather) tire compounds (Hard, Medium, Soft), each offering different balances of grip and durability. There are also Intermediate and Full Wet tires for damp or rainy conditions. Tire strategy – choosing when to pit and which compounds to use – is a crucial aspect of race strategy.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Chassis & Safety:</h4>
          <p>
            The monocoque (chassis) is made from ultra-strong, lightweight carbon fibre composites. Safety features include the Halo cockpit protection device, deformable impact structures, wheel tethers, and advanced driver safety equipment like HANS devices and fire-resistant overalls.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "race-weekend",
    title: "The Race Weekend Format",
    icon: <Flag className="h-5 w-5 mr-2" />,
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          A typical F1 Grand Prix weekend spans three days (usually Friday to Sunday), though some events like Monaco have historical variations.
        </p>
        <p>
          <strong>Practice Sessions:</strong> Usually three sessions (FP1, FP2, FP3) where teams and drivers test car setups, evaluate tire performance, and learn the track.
        </p>
        <p>
          <strong>Qualifying:</strong> This session determines the starting grid for the race. It's typically held in three knockout segments:
          Q1: All drivers participate, the slowest are eliminated.
          Q2: Remaining drivers participate, further eliminations occur.
          Q3: The top 10 drivers fight for pole position (1st place on the grid).
        </p>
        <p>
          <strong>Sprint Weekends (select events):</strong> Some weekends feature a shorter "Sprint" race on Saturday, with its own qualifying session (Sprint Shootout). The Sprint race can award points and sometimes set the grid for the main Grand Prix, though formats have varied.
        </p>
        <p>
          <strong>The Grand Prix (Race):</strong> Held on Sunday, this is the main event where drivers compete over a set number of laps. Points are awarded to the top 10 finishers.
        </p>
      </div>
    ),
  },
  {
    id: "rules-regs",
    title: "Sporting Regulations",
    icon: <Users className="h-5 w-5 mr-2" />,
    content: (
      <div className="space-y-4 text-muted-foreground">
        <div>
          <h4 className="font-semibold text-foreground mb-1">Flags:</h4>
          <ul className="list-disc list-inside ml-4">
            <li><strong>Chequered Flag:</strong> End of session.</li>
            <li><strong>Yellow Flag:</strong> Danger on or near the track, slow down, no overtaking.</li>
            <li><strong>Green Flag:</strong> All clear, normal racing conditions.</li>
            <li><strong>Red Flag:</strong> Session stopped, usually due to a major incident or unsafe conditions.</li>
            <li><strong>Blue Flag:</strong> Shown to a slower car about to be lapped by a faster car; they must let the faster car pass.</li>
            <li><strong>Black Flag:</strong> Driver disqualified.</li>
            <li><strong>Black and White Diagonal Flag:</strong> Unsportsmanlike conduct warning.</li>
            <li><strong>Yellow and Red Striped Flag:</strong> Slippery track surface (oil or water).</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Penalties:</h4>
          <p>
            Drivers can receive various penalties for infringements, including time penalties (e.g., 5 or 10 seconds added to race time or served at a pit stop), drive-through penalties (driving through the pit lane at limited speed), stop-go penalties (stopping in the pit box for a set time), grid penalties (starting further back on the grid), and in severe cases, disqualification.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Points System (Typical):</h4>
          <p>
            Points are awarded to the top 10 finishers in a Grand Prix: 1st: 25, 2nd: 18, 3rd: 15, 4th: 12, 5th: 10, 6th: 8, 7th: 6, 8th: 4, 9th: 2, 10th: 1. An extra point may be awarded for the fastest lap if the driver finishes in the top 10. Sprint races also award points, typically to the top 8.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "drivers-teams",
    title: "Famous Drivers & Teams",
    icon: <Trophy className="h-5 w-5 mr-2" />,
    content: (
       <div className="space-y-3 text-muted-foreground">
        <p>
          Formula 1's history is rich with legendary drivers and iconic teams that have left an indelible mark on the sport.
        </p>
        <p>
          <strong>Legendary Drivers:</strong> Figures like Juan Manuel Fangio (5 championships in the 1950s), Jim Clark (dominant in the 60s), Jackie Stewart (3-time champion and safety advocate), Niki Lauda (champion with Ferrari and McLaren), Alain Prost ("The Professor", 4-time champion), Ayrton Senna (charismatic 3-time champion), Michael Schumacher (record 7 championships), and Lewis Hamilton (also 7 championships) are just a few names that resonate with F1 fans worldwide. Other notable drivers include Sebastian Vettel, Fernando Alonso, Max Verstappen, Kimi Räikkönen, Gilles Villeneuve, and Nigel Mansell.
        </p>
        <p>
          <strong>Iconic Teams:</strong> Ferrari, with its passionate Tifosi and rich heritage, is the oldest and most successful team in F1 history. McLaren and Williams are other British powerhouses with numerous championships. Lotus innovated greatly in aerodynamics and car design. Mercedes has dominated the hybrid era. Red Bull Racing has also achieved multiple championships with innovative designs, becoming a dominant force in the 2010s and 2020s. Other notable teams include Brabham, Renault/Alpine, and Benetton.
        </p>
      </div>
    ),
  },
  {
    id: "circuits",
    title: "Iconic Circuits",
    icon: <MapPin className="h-5 w-5 mr-2" />,
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Formula 1 races on some of the most challenging and historic circuits around the globe. Each track has its unique character and demands.
        </p>
        <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Monaco:</strong> The jewel in the F1 crown, a tight, twisting street circuit demanding ultimate precision.</li>
            <li><strong>Silverstone (UK):</strong> The host of the first F1 World Championship race, known for its high-speed corners like Maggotts, Becketts, and Chapel.</li>
            <li><strong>Monza (Italy):</strong> The "Temple of Speed," famous for its long straights and passionate Ferrari fans (the Tifosi).</li>
            <li><strong>Spa-Francorchamps (Belgium):</strong> A driver favorite, featuring the daunting Eau Rouge/Raidillon sequence and unpredictable weather.</li>
            <li><strong>Suzuka (Japan):</strong> A challenging figure-eight layout, highly regarded by drivers for its 'S' Curves and 130R.</li>
            <li><strong>Interlagos (Brazil):</strong> Known for its passionate crowd and dramatic races, often affected by weather, officially Autódromo José Carlos Pace.</li>
            <li><strong>Nürburgring Nordschleife (Germany - historic):</strong> The "Green Hell," though no longer used for F1 due to safety, it remains legendary for its length and difficulty.</li>
            <li><strong>Circuit de la Sarthe (Le Mans, France - historic for F1):</strong> While famous for the 24-hour race, it also hosted the French Grand Prix in the past.</li>
            <li><strong>Zandvoort (Netherlands):</strong> A historic track with banked corners, returned to the F1 calendar recently.</li>
            <li><strong>Imola (Italy):</strong> The Autodromo Internazionale Enzo e Dino Ferrari, a historic and challenging track.</li>
            <li><strong>Circuit Gilles Villeneuve (Canada):</strong> Known for the "Wall of Champions."</li>
        </ul>
      </div>
    ),
  }
];

export function F1WikiPage() {
  const [userQuery, setUserQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!userQuery.trim()) return;
    setIsLoading(true);
    setSearchResult(null);
    setError(null);
    try {
      const input: F1QueryInput = { userQuery };
      const result: F1QueryOutput = await queryF1Expert(input);
      setSearchResult(result.answer);
    } catch (err) {
      console.error("Error querying F1 expert:", err);
      setError("Sorry, something went wrong while fetching the answer. Please try again.");
      setSearchResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 text-left w-full">
      <Card className="w-full max-w-4xl shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <BookOpen className="w-10 h-10 mr-3 text-primary" />
            <CardTitle className="text-4xl font-bold">Formula 1 Wiki</CardTitle>
          </div>
          <CardDescription>Explore the world of Formula 1 or ask the AI expert.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-8 p-4 border border-border rounded-lg bg-muted/30 shadow">
            <Label htmlFor="f1Query" className="text-lg font-semibold text-foreground mb-2 block">
              Ask anything about Formula 1:
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="f1Query"
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="e.g., Who won the 1976 F1 championship?"
                className="flex-grow"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isLoading || !userQuery.trim()} className="w-full sm:w-auto">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" /> Ask the F1 Expert
                  </>
                )}
              </Button>
            </div>
            {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
            {searchResult && (
              <div className="mt-6 p-4 bg-background/70 rounded-md shadow prose prose-sm dark:prose-invert max-w-none">
                <h3 className="text-xl font-semibold text-primary mb-2">Expert Answer:</h3>
                <div 
                  className="whitespace-pre-wrap" 
                  dangerouslySetInnerHTML={{ __html: formatAIResponse(searchResult) }} 
                />
              </div>
            )}
          </div>

          <h3 className="text-2xl font-semibold text-center mb-4 text-primary">General F1 Topics</h3>
          <ScrollArea className="h-[calc(100vh-var(--header-height,120px)-var(--footer-height,100px)-400px)] pr-4"> {/* Adjust height as needed */}
            <Accordion type="single" collapsible className="w-full">
              {wikiSections.map((section) => (
                <AccordionItem value={section.id} key={section.id}>
                  <AccordionTrigger className="text-xl hover:text-primary transition-colors">
                    <div className="flex items-center">
                      {section.icon}
                      {section.title}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="prose prose-sm dark:prose-invert max-w-none p-2 md:p-4">
                    {section.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
