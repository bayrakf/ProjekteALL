import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    google: any;
    jsPDF: any;
  }
}

const RechnungsGenerator = () => {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [items, setItems] = useState([{ desc: '', qty: 1, price: 0 }]);
  const [formData, setFormData] = useState({
    company: '',
    client: '',
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    vatRate: 20,
    footerNote: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const googleSignInRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Passwort-Schutz
    const pass = prompt("Passwort eingeben:");
    if (pass !== "Teufeline2028!!!") {
      alert("Falsches Passwort!");
      window.history.back(); // Zurück zur vorherigen Seite statt zur Startseite
      return;
    }

    // Load Google APIs
    const script1 = document.createElement('script');
    script1.src = 'https://accounts.google.com/gsi/client';
    script1.async = true;
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script2);

    const script3 = document.createElement('script');
    script3.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
    document.head.appendChild(script3);

    script1.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: '571339195704-h27i7flf8fp0l46enksh7hthe7rvp37d.apps.googleusercontent.com',
          callback: handleCredentialResponse
        });
        
        if (googleSignInRef.current) {
          window.google.accounts.id.renderButton(
            googleSignInRef.current,
            { theme: "outline", size: "large", text: "signin_with", width: 220 }
          );
        }

        // Initialize OAuth2 token client
        const newTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: '571339195704-h27i7flf8fp0l46enksh7hthe7rvp37d.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (tokenResponse: any) => {
            setGoogleAccessToken(tokenResponse.access_token);
            loadClients();
            toast({
              title: "Mit Google Drive verbunden",
              description: "Sie können jetzt Kunden speichern und laden",
            });
          }
        });
        setTokenClient(newTokenClient);
      }
    };

    return () => {
      if (document.head.contains(script1)) document.head.removeChild(script1);
      if (document.head.contains(script2)) document.head.removeChild(script2);
      if (document.head.contains(script3)) document.head.removeChild(script3);
    };
  }, []);

  const handleCredentialResponse = (response: any) => {
    const userObject = parseJwt(response.credential);
    setGoogleUser(userObject);
    document.getElementById('googleSignInBtn')!.style.display = 'none';
    setIsLoggedIn(true);
    
    // Request access token for Drive API
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
    
    toast({
      title: "Erfolgreich angemeldet",
      description: `Angemeldet als ${userObject.email}`,
    });
  };

  const parseJwt = (token: string) => {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  };

  const signOut = () => {
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    setGoogleUser(null);
    setGoogleAccessToken(null);
    setIsLoggedIn(false);
    setClients([]);
    setSelectedClient('');
    if (googleSignInRef.current) {
      googleSignInRef.current.style.display = 'inline-block';
    }
    toast({
      title: "Abgemeldet",
      description: "Sie wurden erfolgreich abgemeldet",
    });
  };

  // Google Drive API functions
  const findFileId = async (name: string): Promise<string | null> => {
    if (!googleAccessToken) return null;
    
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/files?q=' +
        encodeURIComponent(`name='${name}' and trashed=false`) +
        '&fields=files(id,name)', {
          headers: { Authorization: 'Bearer ' + googleAccessToken }
        });
      const data = await response.json();
      return data.files && data.files[0] ? data.files[0].id : null;
    } catch (error) {
      console.error('Error finding file:', error);
      return null;
    }
  };

  const saveFileAsPDF = async (name: string, pdfBlob: Blob) => {
    if (!googleAccessToken) {
      toast({
        title: "Fehler",
        description: "Bitte anmelden!",
        variant: "destructive"
      });
      return;
    }

    try {
      const metadata = { name: name, mimeType: 'application/pdf' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', pdfBlob);

      const existingId = await findFileId(name);
      if (existingId) {
        await fetch('https://www.googleapis.com/upload/drive/v3/files/' + existingId + '?uploadType=multipart', {
          method: 'PATCH',
          headers: { Authorization: 'Bearer ' + googleAccessToken },
          body: form
        });
      } else {
        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + googleAccessToken },
          body: form
        });
      }
    } catch (error) {
      console.error('Error saving file:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern in Google Drive",
        variant: "destructive"
      });
    }
  };

  const loadClients = async () => {
    if (!googleAccessToken) return;
    
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/files?q=' +
        encodeURIComponent(`name contains 'Rechnung_' and mimeType='application/pdf' and trashed=false`) +
        '&fields=files(id,name)', {
          headers: { Authorization: 'Bearer ' + googleAccessToken }
        });
      const data = await response.json();
      
      if (data.files) {
        const clientNames = data.files
          .map((file: any) => {
            const match = file.name.match(/^Rechnung_(.+)_RE-/);
            return match ? match[1] : null;
          })
          .filter((name: string | null) => name !== null)
          .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index);
        
        setClients(clientNames);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const saveClient = async () => {
    if (!isLoggedIn || !googleAccessToken) {
      toast({
        title: "Fehler",
        description: "Bitte zuerst anmelden!",
        variant: "destructive"
      });
      return;
    }

    if (!formData.client) {
      toast({
        title: "Fehler",
        description: "Bitte Kundennamen eingeben",
        variant: "destructive"
      });
      return;
    }

    try {
      const pdfBlob = await generatePDF({ saveOnly: true });
      if (pdfBlob) {
        const invoiceNumber = formData.invoiceNumber || getNextInvoiceNumber();
        const pdfName = `Rechnung_${formData.client}_${invoiceNumber}.pdf`;
        await saveFileAsPDF(pdfName, pdfBlob);
        
        toast({
          title: "Erfolg",
          description: "Kunde gespeichert (PDF in Google Drive)!",
        });
        
        // Reload clients list
        loadClients();
      }
    } catch (error) {
      console.error('Error saving client:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Kunden",
        variant: "destructive"
      });
    }
  };

  const deleteClient = async () => {
    if (!selectedClient || !googleAccessToken) {
      toast({
        title: "Fehler",
        description: "Bitte Kunden auswählen",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Alle Rechnungen für Kunde "${selectedClient}" löschen?`)) {
      return;
    }

    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/files?q=' +
        encodeURIComponent(`name contains 'Rechnung_${selectedClient}_' and mimeType='application/pdf' and trashed=false`) +
        '&fields=files(id,name)', {
          headers: { Authorization: 'Bearer ' + googleAccessToken }
        });
      const data = await response.json();
      
      if (data.files) {
        for (const file of data.files) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + googleAccessToken }
          });
        }
      }

      toast({
        title: "Erfolg",
        description: `Kunde "${selectedClient}" wurde gelöscht`,
      });
      
      setSelectedClient('');
      setFormData({ ...formData, client: '' });
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Löschen des Kunden",
        variant: "destructive"
      });
    }
  };

  const fillClientFromSelect = (clientName: string) => {
    if (clientName === "new-client") {
      setSelectedClient('');
      setFormData({ ...formData, client: '' });
    } else {
      setSelectedClient(clientName);
      setFormData({ ...formData, client: clientName });
    }
  };

  const calculateTotals = (items) => {
    let netto = 0;
    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      netto += qty * price;
    });
    const vatRate = formData.vatRate / 100;
    const vat = Math.round(netto * vatRate * 100) / 100;
    const total = Math.round((netto + vat) * 100) / 100;
    return { netto, vat, total };
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
    const totals = calculateTotals(updatedItems);
    setFormData({ ...formData, netto: totals.netto, vat: totals.vat, total: totals.total });
  };

  const addItem = () => {
    setItems([...items, { desc: '', qty: 1, price: 0 }]);
  };

  const removeItem = (index) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    const totals = calculateTotals(updatedItems);
    setFormData({ ...formData, netto: totals.netto, vat: totals.vat, total: totals.total });
  };

  useEffect(() => {
    const totals = calculateTotals(items);
    setFormData({ ...formData, netto: totals.netto, vat: totals.vat, total: totals.total });
  }, [items]);

  const getNextInvoiceNumber = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const key = `lastInvoice-${y}-${m}`;
    let n = parseInt(localStorage.getItem(key) || '0') + 1;
    localStorage.setItem(key, n.toString());
    return `RE-${y}${m}-${String(n).padStart(3, '0')}`;
  };

  const generatePDF = async (options?: { saveOnly?: boolean }): Promise<Blob | void> => {
    if (!formData.company || !formData.client || !formData.date) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus",
        variant: "destructive"
      });
      return;
    }

    const validItems = items.filter(item => item.desc.trim() && item.price > 0);
    if (validItems.length === 0) {
      toast({
        title: "Fehler", 
        description: "Mindestens eine Position mit Preis > 0 erforderlich",
        variant: "destructive"
      });
      return;
    }

    if (!window.jsPDF) {
      toast({
        title: "Fehler",
        description: "PDF-Bibliothek noch nicht geladen",
        variant: "destructive"
      });
      return;
    }

    const { jsPDF } = window;
    const doc = new jsPDF();
    const invoiceNumber = formData.invoiceNumber || getNextInvoiceNumber();
    const { netto, vat, total } = calculateTotals(items);

    // Logo hinzufügen falls vorhanden
    if (logoPreview) {
      try {
        const img = new Image();
        img.src = logoPreview;
        await new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        if (img.width > 0) {
          const aspectRatio = img.height / img.width;
          const logoWidth = 50;
          const logoHeight = logoWidth * aspectRatio;
          doc.addImage(img, 'PNG', 15, 15, logoWidth, logoHeight);
        }
      } catch (error) {
        console.log('Logo could not be added:', error);
      }
    }

    // Header
    let y = 15;
    doc.setFontSize(18);
    doc.text('RECHNUNG', 205, y, { align: 'right' });
    y += 10;
    doc.setFontSize(10);
    doc.text(`Rechnungsnr: ${invoiceNumber}`, 205, y, { align: 'right' });
    y += 6;
    doc.text(`Datum: ${formData.date}`, 205, y, { align: 'right' });
    y += 15;

    // Company and client info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formData.company, 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Rechnung an: ' + formData.client, 15, y);
    y += 20;

    // Items table
    const headers = [['Pos', 'Beschreibung', 'Menge', 'Einzelpreis', 'Gesamt']];
    const rows = validItems.map((item, i) => [
      i + 1,
      item.desc,
      item.qty,
      item.price.toFixed(2).replace('.', ','),
      (item.qty * item.price).toFixed(2).replace('.', ',')
    ]);

    doc.autoTable({
      startY: y,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 
        0: { cellWidth: 15 }, 
        1: { cellWidth: 80 }, 
        2: { cellWidth: 20 }, 
        3: { cellWidth: 30 }, 
        4: { cellWidth: 30 } 
      }
    });

    // Summary
    y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Netto: ${netto.toFixed(2).replace('.', ',')} €`, 205, y, { align: 'right' });
    y += 7;
    doc.text(`MwSt (${formData.vatRate}%): ${vat.toFixed(2).replace('.', ',')} €`, 205, y, { align: 'right' });
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Gesamt: ${total.toFixed(2).replace('.', ',')} €`, 205, y, { align: 'right' });

    // Footer
    if (formData.footerNote) {
      y += 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(formData.footerNote, 15, y);
    }

    if (options?.saveOnly) {
      return new Promise(resolve => {
        const pdfBlob = doc.output('blob');
        resolve(pdfBlob);
      });
    } else {
      doc.save(`Rechnung_${invoiceNumber}.pdf`);
      toast({
        title: "Erfolg",
        description: "Rechnung wurde erstellt",
      });
    }
  };

  useEffect(() => {
    console.log("RechnungsGenerator component loaded");
  }, []);

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-primary">
              Professioneller Rechnungs-Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google Sign In */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              {!isLoggedIn ? (
                <div className="flex items-center gap-4">
                  <div ref={googleSignInRef}></div>
                  <span className="text-muted-foreground">🔓 Nicht angemeldet</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="text-foreground">🔐 Angemeldet als {googleUser?.email}</span>
                  <Button onClick={signOut} variant="destructive">
                    🚪 Abmelden
                  </Button>
                </div>
              )}
            </div>

            {/* Logo and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="logoUpload">Logo (optional):</Label>
                <Input
                  id="logoUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="mt-1"
                />
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt="Logo Vorschau"
                    className="mt-2 max-w-32 max-h-16 object-contain"
                  />
                )}
              </div>
              <div>
                <Label htmlFor="date" className="text-destructive">Rechnungsdatum: *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            {/* Company and Client */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="company" className="text-destructive">Dein Name / Firma: *</Label>
                <Input
                  id="company"
                  placeholder="Max Mustermann GmbH"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              
              {/* Client Selection */}
              <div>
                <Label htmlFor="clientSelect" className="text-destructive">Kunde auswählen: *</Label>
                <Select
                  value={selectedClient}
                  onValueChange={fillClientFromSelect}
                  disabled={!isLoggedIn}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Neuen Kunden anlegen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new-client">Neuen Kunden anlegen</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Input
                  id="client"
                  placeholder="Kundenname eingeben"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              
              {/* Client Actions */}
              <div className="flex gap-4">
                <Button 
                  onClick={saveClient} 
                  disabled={!isLoggedIn}
                  className="flex-1"
                >
                  💾 Daten speichern
                </Button>
                <Button 
                  onClick={deleteClient} 
                  disabled={!isLoggedIn || !selectedClient}
                  variant="destructive"
                  className="flex-1"
                >
                  🗑️ Kunde löschen
                </Button>
              </div>
            </div>

            {/* Invoice Number and VAT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoiceNumber">Rechnungsnummer (optional):</Label>
                <Input
                  id="invoiceNumber"
                  placeholder="Wird automatisch generiert"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="vatRate">Mehrwertsteuer (%):</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.1"
                  value={formData.vatRate}
                  onChange={(e) => setFormData({ ...formData, vatRate: parseFloat(e.target.value) || 20 })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Positionen</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-3 text-left">Beschreibung *</th>
                      <th className="border border-border p-3 text-left">Menge</th>
                      <th className="border border-border p-3 text-left">Preis (€) *</th>
                      <th className="border border-border p-3 text-left">Gesamt</th>
                      <th className="border border-border p-3 text-left">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="border border-border p-2">
                          <Input
                            value={item.desc}
                            onChange={(e) => updateItem(index, 'desc', e.target.value)}
                            placeholder="Beschreibung eingeben"
                            required
                          />
                        </td>
                        <td className="border border-border p-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="border border-border p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </td>
                        <td className="border border-border p-2 font-medium">
                          {(item.qty * item.price).toFixed(2)} €
                        </td>
                        <td className="border border-border p-2">
                          <Button
                            onClick={() => removeRow(index)}
                            variant="destructive"
                            size="sm"
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={addRow} className="mt-4">
                + Position hinzufügen
              </Button>
            </div>

            {/* Rechnungspositionen */}
            <Card>
              <CardHeader>
                <CardTitle>Rechnungspositionen</CardTitle>
              </CardHeader>
              <CardContent>
                {items.map((item, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <Input
                      placeholder="Beschreibung"
                      value={item.desc}
                      onChange={(e) => handleItemChange(index, 'desc', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Menge"
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Preis"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                    />
                    <Button variant="destructive" onClick={() => removeItem(index)}>Entfernen</Button>
                  </div>
                ))}
                <Button onClick={addItem}>Position hinzufügen</Button>
              </CardContent>
            </Card>

            {/* Zusammenfassung */}
            <Card>
              <CardHeader>
                <CardTitle>Zusammenfassung</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Netto: {formData.netto} €</p>
                <p>Mehrwertsteuer ({formData.vatRate}%): {formData.vat} €</p>
                <p>Gesamt: {formData.total} €</p>
              </CardContent>
            </Card>

            {/* Footer Note */}
            <div>
              <Label htmlFor="footerNote">Fußtext / Hinweise:</Label>
              <Textarea
                id="footerNote"
                rows={3}
                placeholder="Bankverbindung, Zahlungsbedingungen..."
                value={formData.footerNote}
                onChange={(e) => setFormData({ ...formData, footerNote: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Generate PDF Button */}
            <Button onClick={() => generatePDF()} className="w-full" size="lg">
              📄 Professionelle PDF erstellen
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RechnungsGenerator;