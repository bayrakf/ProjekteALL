import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, Mail, Phone } from "lucide-react";

const ImpressumPage = () => {
  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Impressum
          </h1>
          <p className="text-xl text-muted-foreground">
            Rechtliche Informationen gemäß § 5 TMG
          </p>
        </div>

        <div className="space-y-8">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-primary" />
                <span>Angaben gemäß § 5 TMG</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Firmenname:</h3>
                <p className="text-muted-foreground">HausCare GmbH</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Anschrift:</h3>
                <p className="text-muted-foreground">
                  Musterstraße 1<br />
                  12345 Berlin<br />
                  Deutschland
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Vertreten durch:</h3>
                <p className="text-muted-foreground">Max Mustermann (Geschäftsführer)</p>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Phone className="w-6 h-6 text-primary" />
                <span>Kontakt</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Telefon:</h3>
                <p className="text-muted-foreground">+49 123 456 789</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">E-Mail:</h3>
                <p className="text-muted-foreground">info@hauscare.de</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Internetadresse:</h3>
                <p className="text-muted-foreground">www.hauscare.de</p>
              </div>
            </CardContent>
          </Card>

          {/* Registration Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-6 h-6 text-primary" />
                <span>Registereintrag</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Eintragung im Handelsregister:</h3>
                <p className="text-muted-foreground">Registergericht: Amtsgericht Berlin</p>
                <p className="text-muted-foreground">Registernummer: HRB 123456</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Umsatzsteuer-ID:</h3>
                <p className="text-muted-foreground">
                  Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />
                  DE123456789
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Berufsrechtliche Regelungen:</h3>
                <p className="text-muted-foreground">
                  Handwerkskammer Berlin<br />
                  Betriebsnummer: 12345678
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Liability Disclaimer */}
          <Card>
            <CardHeader>
              <CardTitle>Haftungsausschluss</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Haftung für Inhalte</h3>
                <p className="text-muted-foreground">
                  Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte 
                  auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach 
                  §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht unter der 
                  Verpflichtung, übermittelte oder gespeicherte fremde Informationen zu 
                  überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige 
                  Tätigkeit hinweisen.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Haftung für Links</h3>
                <p className="text-muted-foreground">
                  Unser Angebot enthält Links zu externen Websites Dritter, auf deren 
                  Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden 
                  Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten 
                  Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten 
                  verantwortlich.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Urheberrecht</h3>
                <p className="text-muted-foreground">
                  Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen 
                  Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, 
                  Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der 
                  Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des 
                  jeweiligen Autors bzw. Erstellers.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Protection */}
          <Card>
            <CardHeader>
              <CardTitle>Datenschutz</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Die Nutzung unserer Webseite ist in der Regel ohne Angabe 
                personenbezogener Daten möglich. Soweit auf unseren Seiten 
                personenbezogene Daten (beispielsweise Name, Anschrift oder 
                E-Mail-Adressen) erhoben werden, erfolgt dies, soweit möglich, 
                stets auf freiwilliger Basis.
              </p>
              <p className="text-muted-foreground">
                Wir weisen darauf hin, dass die Datenübertragung im Internet 
                (z.B. bei der Kommunikation per E-Mail) Sicherheitslücken 
                aufweisen kann. Ein lückenloser Schutz der Daten vor dem 
                Zugriff durch Dritte ist nicht möglich.
              </p>
            </CardContent>
          </Card>

          {/* Responsible Person */}
          <Card>
            <CardHeader>
              <CardTitle>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Max Mustermann<br />
                Musterstraße 1<br />
                12345 Berlin
              </p>
            </CardContent>
          </Card>

          {/* Last Updated */}
          <div className="text-center text-muted-foreground text-sm border-t border-border pt-8">
            <p>Stand: Januar 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpressumPage;