import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Phone, FileText, Wrench, Calculator } from "lucide-react";

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/leistungen", label: "Leistungen", icon: Wrench },
    { path: "/kontakt", label: "Kontakt", icon: Phone },
    { path: "/rechnungsgenerator", label: "Rechnungen", icon: Calculator },
    { path: "/impressum", label: "Impressum", icon: FileText },
  ];

  console.log("Navigation rendered", navItems);

  return (
    <nav className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">HausCare</span>
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <Button className="hidden md:block">
            Kostenlose Beratung
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;