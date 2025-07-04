import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { 
  Home, 
  Leaf, 
  Shield, 
  Clock, 
  Wrench, 
  Droplets, 
  Car, 
  PaintBucket,
  Zap,
  ArrowRight
} from "lucide-react";

const ServicesPage = () => {
  const mainServices = [
    {
      icon: Home,
      title: "Hausreinigung",
      description: "Professionelle Reinigung von Innen- und Außenbereichen",
      features: [
        "Grundreinigung und Unterhaltsreinigung",
        "Fensterreinigung innen und außen",
        "Treppenhaus- und Kellerreinigung",
        "Büroreinigung für Gewerbekunden"
      ],
      price: "ab 25€/Stunde"
    },
    {
      icon: Leaf,
      title: "Gartenpflege",
      description: "Komplette Gartenbetreuung das ganze Jahr über",
      features: [
        "Rasenmähen und Rasenpflege",
        "Heckenschnitt und Baumpflege",
        "Unkrautentfernung",
        "Winterdienst und Laubentfernung"
      ],
      price: "ab 30€/Stunde"
    },
    {
      icon: Shield,
      title: "Hausverwaltung",
      description: "Umfassende Betreuung Ihrer Immobilie",
      features: [
        "Objektbetreuung bei Abwesenheit",
        "Schlüsselservice und Zugangskontrolle",
        "Koordination von Handwerkern",
        "Regelmäßige Objektkontrollen"
      ],
      price: "Auf Anfrage"
    },
    {
      icon: Clock,
      title: "24h Notfalldienst",
      description: "Rund um die Uhr verfügbar für Notfälle",
      features: [
        "Wasserrohrbrüche und Leckagen",
        "Heizungsausfälle",
        "Elektrische Notfälle",
        "Einbruchschäden"
      ],
      price: "ab 80€ Anfahrt"
    }
  ];

  const additionalServices = [
    {
      icon: Wrench,
      title: "Kleine Reparaturen",
      description: "Handwerkerarbeiten für den Hausgebrauch"
    },
    {
      icon: Droplets,
      title: "Rohrreinigung",
      description: "Professionelle Abfluss- und Rohrreinigung"
    },
    {
      icon: Car,
      title: "Winterdienst",
      description: "Schneeräumung und Streudienst"
    },
    {
      icon: PaintBucket,
      title: "Malerarbeiten",
      description: "Innen- und Außenanstriche"
    },
    {
      icon: Zap,
      title: "Elektriker-Service",
      description: "Kleinere Elektroarbeiten"
    }
  ];

  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Unsere Leistungen
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Professionelle Hausbetreuung mit über 10 Jahren Erfahrung. 
            Von der Reinigung bis zum Notfalldienst - wir sind Ihr zuverlässiger Partner.
          </p>
        </div>

        {/* Main Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
          {mainServices.map((service, index) => {
            const Icon = service.icon;
            return (
              <Card key={index} className="h-full hover:shadow-card transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <Icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl text-foreground">
                        {service.title}
                      </CardTitle>
                      <p className="text-primary font-semibold">{service.price}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-6">
                    {service.description}
                  </p>
                  <ul className="space-y-3 mb-6">
                    {service.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-2">
                        <ArrowRight className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/kontakt">
                    <Button className="w-full">
                      Angebot anfordern
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Services */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Weitere Dienstleistungen
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {additionalServices.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card key={index} className="text-center hover:shadow-card transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-secondary-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {service.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Service Process */}
        <div className="bg-muted rounded-2xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            So funktioniert's
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Kontaktaufnahme",
                description: "Rufen Sie uns an oder nutzen Sie unser Kontaktformular"
              },
              {
                step: "2",
                title: "Kostenlose Beratung",
                description: "Wir besprechen Ihre Wünsche und erstellen ein Angebot"
              },
              {
                step: "3",
                title: "Terminplanung",
                description: "Flexible Terminvereinbarung nach Ihren Wünschen"
              },
              {
                step: "4",
                title: "Professionelle Ausführung",
                description: "Zuverlässige und qualitätsvolle Durchführung der Arbeiten"
              }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {item.title}
                </h3>
                <p className="text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-hero rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">
            Bereit für unsere Dienstleistungen?
          </h2>
          <p className="text-xl mb-8 text-gray-200">
            Kontaktieren Sie uns für eine kostenlose Beratung und ein individuelles Angebot
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/kontakt">
              <Button size="lg" className="bg-white text-primary hover:bg-gray-100">
                Kostenlose Beratung
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              +49 123 456 789
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesPage;