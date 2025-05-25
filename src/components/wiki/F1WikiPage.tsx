
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BookOpen, History, Car, Flag, Users, Trophy, MapPin } from 'lucide-react';

interface WikiSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
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
          <strong>Legendary Drivers:</strong> Figures like Juan Manuel Fangio (5 championships in the 1950s), Jim Clark (dominant in the 60s), Jackie Stewart (3-time champion and safety advocate), Niki Lauda (champion with Ferrari and McLaren), Alain Prost ("The Professor", 4-time champion), Ayrton Senna (charismatic 3-time champion), Michael Schumacher (record 7 championships), and Lewis Hamilton (also 7 championships) are just a few names that resonate with F1 fans worldwide. Each brought unique skill, determination, and personality to the pinnacle of motorsport.
        </p>
        <p>
          <strong>Iconic Teams:</strong> Ferrari, with its passionate Tifosi and rich heritage, is the oldest and most successful team in F1 history. McLaren and Williams are other British powerhouses with numerous championships. Lotus innovated greatly in aerodynamics and car design. Mercedes has dominated the hybrid era. Red Bull Racing has also achieved multiple championships with innovative designs.
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
            <li><strong>Silverstone (UK):</strong> The host of the first F1 World Championship race, known for its high-speed corners.</li>
            <li><strong>Monza (Italy):</strong> The "Temple of Speed," famous for its long straights and passionate Ferrari fans (the Tifosi).</li>
            <li><strong>Spa-Francorchamps (Belgium):</strong> A driver favorite, featuring the daunting Eau Rouge/Raidillon sequence and unpredictable weather.</li>
            <li><strong>Suzuka (Japan):</strong> A challenging figure-eight layout, highly regarded by drivers.</li>
            <li><strong>Interlagos (Brazil):</strong> Known for its passionate crowd and dramatic races, often affected by weather.</li>
            <li><strong>Nürburgring Nordschleife (Germany - historic):</strong> The "Green Hell," though no longer used for F1 due to safety, it remains legendary.</li>
        </ul>
      </div>
    ),
  }
];

export function F1WikiPage() {
  return (
    <div className="flex flex-col items-center p-4 text-left w-full">
      <Card className="w-full max-w-4xl shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <BookOpen className="w-10 h-10 mr-3 text-primary" />
            <CardTitle className="text-4xl font-bold">Formula 1 Wiki</CardTitle>
          </div>
          <CardDescription>Explore the world of Formula 1.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-var(--header-height,120px)-var(--footer-height,100px)-150px)] pr-4"> {/* Adjust height as needed */}
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
