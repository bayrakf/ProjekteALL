import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Home, Leaf, Shield, Clock, CheckCircle, Star } from "lucide-react";
import heroImage from "@/assets/hero-home.jpg";
import servicesImage from "@/assets/services-illustration.jpg";

const HomePage = () => {
  const services = [
    {
      icon: Home,
      title: "Hausreinigung",
      description: "Professionelle Reinigung Ihrer Immobilie mit umweltfreundlichen Produkten.",
    },
    {
      icon: Leaf,
      title: "Gartenpflege",
      description: "Komplette Gartenpflege vom Rasenmähen bis zur Baumpflege.",
    },
    {
      icon: Shield,
      title: "Hausverwaltung",
      description: "Umfassende Betreuung und Verwaltung Ihrer Immobilie.",
    },
    {
      icon: Clock,
      title: "24h Notfalldienst",
      description: "Rund um die Uhr erreichbar für dringende Reparaturen.",
    },
  ];

  const features = [
    "Über 10 Jahre Erfahrung",
    "Versichert und zertifiziert",
    "Kostenlose Erstberatung",
    "Flexible Termine",
    "Faire Preise",
    "Zufriedenheitsgarantie",
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative h-screen flex items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Professionelle <span className="text-accent">Hausbetreuung</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">
            Wir kümmern uns um Ihr Zuhause, damit Sie sich entspannen können.
            Zuverlässig, professionell und mit Herz.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6">
              Kostenlose Beratung
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20">
              <Link to="/leistungen">Unsere Leistungen</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Unsere Leistungen
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Von der Reinigung bis zur kompletten Hausverwaltung - 
              wir bieten alle Dienstleistungen rund um Ihre Immobilie.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card key={index} className="group hover:shadow-card transition-all duration-300 hover:-translate-y-2">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <Icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-foreground">
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center">
            <Link to="/leistungen">
              <Button size="lg" variant="outline">
                Alle Leistungen ansehen
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-6">
                Warum HausCare wählen?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Mit über 10 Jahren Erfahrung in der Hausbetreuung sind wir Ihr 
                zuverlässiger Partner für alle Immobiliendienstleistungen.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <Link to="/kontakt">
                <Button className="bg-gradient-secondary hover:bg-secondary-hover">
                  Jetzt Kontakt aufnehmen
                </Button>
              </Link>
            </div>

            <div className="relative">
              <img 
                src={servicesImage} 
                alt="Unsere Dienstleistungen" 
                className="rounded-lg shadow-elegant w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Das sagen unsere Kunden
            </h2>
            <p className="text-xl text-muted-foreground">
              Zufriedene Kunden sind unser bester Beweis für Qualität
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Maria Schmidt",
                text: "Absolut zuverlässig und professionell. Unser Haus war noch nie so sauber!",
                rating: 5,
              },
              {
                name: "Thomas Weber",
                text: "Die Gartenpflege ist hervorragend. Unser Garten sieht das ganze Jahr perfekt aus.",
                rating: 5,
              },
              {
                name: "Anna Müller",
                text: "Sehr freundliches Team und faire Preise. Kann ich nur weiterempfehlen!",
                rating: 5,
              },
            ].map((testimonial, index) => (
              <Card key={index} className="bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-accent fill-current" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 italic">
                    "{testimonial.text}"
                  </p>
                  <p className="font-semibold text-foreground">
                    {testimonial.name}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-hero text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Bereit für professionelle Hausbetreuung?
          </h2>
          <p className="text-xl mb-8 text-gray-200">
            Kontaktieren Sie uns heute für eine kostenlose Beratung
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
      </section>
    </div>
  );
};

export default HomePage;