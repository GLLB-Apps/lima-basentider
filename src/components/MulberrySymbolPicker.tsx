import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import { Search, X, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { uploadSymbol, saveSymbolMessage, getSymbolUrl, getSymbolMessages } from '../services/appwriteService';

interface MulberrySymbolsProps {
  sourceUrl: string;
  symbolType?: 'open' | 'closed' | 'away';
  onCompleted?: (data: { svgString: string; id?: string; message: string; url: string }) => void;
  initialMessage?: string;
  onClose?: () => void; // For final closing
}

const steps = ['Välj symbol', 'Skriv meddelande', 'Klar'];

const MulberrySymbols: React.FC<MulberrySymbolsProps> = ({
  sourceUrl,
  symbolType,
  onCompleted,
  initialMessage = '',
  onClose
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [icons, setIcons] = useState<{ svg: string; id?: string }[]>([]);
  const [filteredIcons, setFilteredIcons] = useState<typeof icons>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // States for symbol selection and upload
  const [selectedIcon, setSelectedIcon] = useState<{ svg: string; id?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  
  // State for message
  const [message, setMessage] = useState(initialMessage);
  const [isSavingMessage, setIsSavingMessage] = useState(false);
  
  // States for existing data
  const [currentSymbolUrl, setCurrentSymbolUrl] = useState<string | null>(null);
  const [existingMessage, setExistingMessage] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);
  
  // Notification state
  const [notification, setNotification] = useState<{ 
    open: boolean; 
    message: string; 
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Flag to track if everything has been saved
  const [isComplete, setIsComplete] = useState(false);

  // Get color based on symbol type
  const getSymbolColor = () => {
    if (symbolType === 'open') {
      return {
        main: 'success.main',
        bg: 'rgba(0, 255, 8, 0.1)'
      };
    } else if (symbolType === 'closed') {
      return {
        main: 'error.main',
        bg: 'rgba(255, 0, 0, 0.1)'
      };
    } else if (symbolType === 'away') {
      return {
        main: 'warning.main',
        bg: 'rgba(255, 152, 0, 0.1)'
      };
    }
    // Default fallback
    return {
      main: 'primary.main',
      bg: 'rgba(25, 118, 210, 0.1)'
    };
  };

  // Get symbol type display name
  const getSymbolTypeName = () => {
    if (symbolType === 'open') return 'öppet';
    if (symbolType === 'closed') return 'stängt';
    if (symbolType === 'away') return 'bortaläge';
    return '';
  };

  // Load existing symbol and message on component mount
  useEffect(() => {
    if (symbolType) {
      loadExistingData();
    }
  }, [symbolType]);

  const loadExistingData = async () => {
    if (!symbolType) return;
    
    setLoadingExisting(true);
    try {
      // Get symbol URL
      const symbolUrl = getSymbolUrl(symbolType);
      if (symbolUrl) {
        setCurrentSymbolUrl(symbolUrl + '&timestamp=' + Date.now());
      }
      
      // Get message
      const messages = await getSymbolMessages();
      if (messages) {
        let currentMessage = '';
        if (symbolType === 'open') {
          currentMessage = messages.openMessage || '';
        } else if (symbolType === 'closed') {
          currentMessage = messages.closedMessage || '';
        } else if (symbolType === 'away') {
          currentMessage = messages.awayMessage || '';
        }
        
        setExistingMessage(currentMessage);
        setMessage(currentMessage);
      }
    } catch (err) {
      console.error('Error loading existing data:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    const loadSvgIcons = async () => {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`Failed to load SVGs: ${response.statusText}`);
    
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
    
        const iconElements = Array.from(doc.querySelectorAll('.icon'));
        const iconsParsed = iconElements.map(icon => {
          const img = icon.querySelector('img');
          const title = icon.querySelector('.icon__title');
    
          const svgDataUrl = img?.getAttribute('src') || '';
          const id = title?.textContent?.trim() || '';

          const decodedSvg = decodeURIComponent(svgDataUrl.replace('data:image/svg+xml;utf8,', ''));

          return { svg: decodedSvg, id };
        });

        setIcons(iconsParsed);
        setFilteredIcons(iconsParsed);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadSvgIcons();
  }, [sourceUrl]);

  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase();
    setFilteredIcons(
      icons.filter(icon =>
        icon.id?.toLowerCase().includes(lowerQuery)
      )
    );
  }, [searchQuery, icons]);

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Handle icon selection - ONLY updates the state
  const handleIconSelect = (icon: { svg: string; id?: string }) => {
    setSelectedIcon(icon);
  };

  // Handle next step - NEVER closes the dialog
  const handleNext = async () => {
    if (activeStep === 0 && selectedIcon) {
      // Upload symbol when going from step 0 to step 1
      if (symbolType) {
        setIsUploading(true);
        try {
          const url = await uploadSymbol(symbolType, selectedIcon.svg);
          if (url) {
            setCurrentSymbolUrl(url + '&timestamp=' + Date.now());
            setUploadedUrl(url); // Store the URL for the final completion
            
            setNotification({
              open: true,
              message: 'Symbol uppladdad!',
              severity: 'success'
            });
          }
        } catch (err) {
          console.error('Error uploading symbol:', err);
          setNotification({
            open: true,
            message: 'Kunde inte ladda upp symbolen.',
            severity: 'error'
          });
          return; // Don't proceed to next step if upload failed
        } finally {
          setIsUploading(false);
        }
      }
    } else if (activeStep === 1) {
      // Save message when going from step 1 to step 2
      if (symbolType) {
        setIsSavingMessage(true);
        try {
          const success = await saveSymbolMessage(symbolType, message);
          if (success) {
            setExistingMessage(message);
            setNotification({
              open: true,
              message: 'Meddelande sparat!',
              severity: 'success'
            });
            setIsComplete(true); // Mark as complete after saving message
          } else {
            throw new Error('Failed to save message');
          }
        } catch (err) {
          console.error('Error saving message:', err);
          setNotification({
            open: true,
            message: 'Kunde inte spara meddelandet.',
            severity: 'error'
          });
          return; // Don't proceed to next step if save failed
        } finally {
          setIsSavingMessage(false);
        }
      }
    } else if (activeStep === 2 && isComplete && onClose) {
      // Call onCompleted with all the data when done
      if (onCompleted && selectedIcon && uploadedUrl) {
        onCompleted({
          svgString: selectedIcon.svg,
          id: selectedIcon.id,
          message: message,
          url: uploadedUrl
        });
      }
      
      // Close dialog on the final step when clicking "Klar" button
      onClose();
      return; // Don't proceed to non-existent step 3
    }
    
    // Proceed to next step
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  // Handle previous step
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Handle reset
  const handleReset = () => {
    setActiveStep(0);
    setSelectedIcon(null);
    setMessage(existingMessage);
  };

  // Close notification
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const symbolColor = getSymbolColor();
  const symbolTypeName = getSymbolTypeName();

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Choose symbol
        return (
          <Box>
            {/* Existing Symbol Display */}
            {loadingExisting ? (
              <Box display="flex" justifyContent="center" my={2}>
                <CircularProgress size={24} />
              </Box>
            ) : currentSymbolUrl ? (
              <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Nuvarande {symbolTypeName} symbol:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    component="img"
                    src={currentSymbolUrl}
                    alt={`Current ${symbolType} symbol`}
                    sx={{
                      width: 60,
                      height: 60,
                      objectFit: 'contain',
                      p: 1,
                      bgcolor: symbolColor.bg,
                      borderRadius: 1
                    }}
                  />
                  <Box>
                    <Typography variant="body2">
                      {existingMessage ? (
                        <>Meddelande: <em>"{existingMessage}"</em></>
                      ) : (
                        <em>Inget meddelande</em>
                      )}
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      sx={{ mt: 0.5 }}
                      onClick={() => {
                        setActiveStep(1);
                        setMessage(existingMessage);
                      }}
                    >
                      Redigera endast meddelande
                    </Button>
                  </Box>
                </Box>
              </Box>
            ) : null}
            
            {/* Search Field */}
            <Paper
              component="form"
              onSubmit={(e) => e.preventDefault()}
              sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 1 }}
            >
              <InputBase
                placeholder="Sök symboler..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 1, ml: 1 }}
              />
              {searchQuery && (
                <IconButton onClick={handleClearSearch}>
                  <X size={20} />
                </IconButton>
              )}
              <IconButton disabled>
                <Search size={20} />
              </IconButton>
            </Paper>

            {/* Selected Symbol Preview */}
            {selectedIcon && symbolType && (
              <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Paper
                    sx={{
                      width: 60,
                      height: 60,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      p: 1,
                      border: '1px solid',
                      borderColor: symbolColor.main,
                      bgcolor: symbolColor.bg
                    }}
                  >
                    <Box
                      component="img"
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(selectedIcon.svg)}`}
                      alt={selectedIcon.id || 'selected symbol'}
                      sx={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </Paper>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {selectedIcon.id || 'Unnamed symbol'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Vald som {symbolTypeName} symbol
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Loading, Error, Grid */}
            {loading && (
              <Box display="flex" justifyContent="center" m={4}>
                <CircularProgress />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {!loading && !error && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, maxHeight: '400px', overflowY: 'auto' }}>
                {filteredIcons.map((icon, idx) => (
                  <Box key={idx} sx={{ width: 80 }}>
                    <Paper
                      sx={{
                        width: '100%',
                        height: 80,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer',
                        p: 1,
                        overflow: 'hidden',
                        border: selectedIcon?.id === icon.id ? '2px solid #1976d2' : 'none',
                        transition: 'border 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: 3
                        }
                      }}
                      onClick={() => handleIconSelect(icon)}
                    >
                      <Box
                        component="img"
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(icon.svg)}`}
                        alt={icon.id || 'symbol'}
                        sx={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    </Paper>
                    {icon.id && (
                      <Typography variant="caption" display="block" textAlign="center" noWrap>
                        {icon.id}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {!loading && !filteredIcons.length && (
              <Typography align="center" variant="body2" color="textSecondary" mt={4}>
                Inga symboler hittades. Prova att rensa sökningen.
              </Typography>
            )}
          </Box>
        );
        
      case 1: // Write message
        return (
          <Box>
            {/* Current Symbol Display */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
              <Paper
                sx={{
                  width: 60,
                  height: 60,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  p: 1,
                  border: '1px solid',
                  borderColor: symbolColor.main,
                  bgcolor: symbolColor.bg
                }}
              >
                {selectedIcon ? (
                  <Box
                    component="img"
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(selectedIcon.svg)}`}
                    alt={selectedIcon.id || 'selected symbol'}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                  />
                ) : currentSymbolUrl ? (
                  <Box
                    component="img"
                    src={currentSymbolUrl}
                    alt={`Current ${symbolType} symbol`}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <Typography variant="caption">Ingen symbol</Typography>
                )}
              </Paper>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {selectedIcon?.id || `${symbolTypeName} symbol`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedIcon ? 'Ny vald symbol' : 'Nuvarande symbol'}
                </Typography>
              </Box>
            </Box>
            
            {/* Message input */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Meddelande
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder={`Skriv ett meddelande som visas när ${
                  symbolType === 'open' ? 'det är öppet' : 
                  symbolType === 'closed' ? 'det är stängt' : 
                  'du är borta'
                }...`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                variant="outlined"
                sx={{ mb: 2 }}
              />
              <Typography variant="caption" color="text.secondary">
                Detta meddelande kommer att visas till besökare tillsammans med symbolen.
              </Typography>
            </Paper>
          </Box>
        );
        
      case 2: // Summary/Complete
        return (
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <Check size={32} color="white" />
            </Box>
            
            <Typography variant="h6" gutterBottom>
              Ändringarna har sparats!
            </Typography>
            
            <Typography variant="body1" paragraph>
              {selectedIcon ? 'Symbolen och meddelandet har sparats.' : 'Meddelandet har uppdaterats.'}
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 3 }}>
              {/* Preview */}
              <Paper
                sx={{
                  p: 2,
                  width: '100%',
                  maxWidth: 300,
                  bgcolor: symbolColor.bg,
                  border: '1px solid',
                  borderColor: symbolColor.main,
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Förhandsgranskning:
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Box
                    component="img"
                    src={selectedIcon 
                      ? `data:image/svg+xml;utf8,${encodeURIComponent(selectedIcon.svg)}`
                      : currentSymbolUrl || ''}
                    alt={`${symbolType} symbol`}
                    sx={{
                      width: 60,
                      height: 60,
                      objectFit: 'contain'
                    }}
                  />
                  
                  <Typography variant="body2" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                    {message || <em>Inget meddelande</em>}
                  </Typography>
                </Box>
              </Paper>
              
              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{ mt: 2 }}
              >
                Börja om
              </Button>
            </Box>
          </Box>
        );
        
      default:
        return 'Unknown step';
    }
  };

  const isNextDisabled = () => {
    if (activeStep === 0) {
      return !selectedIcon; // Require symbol selection for step 1
    }
    return false; // Allow proceeding through other steps
  };

  const getNextButtonText = () => {
    if (isUploading || isSavingMessage) return 'Sparar...';
    if (activeStep === steps.length - 1) return 'Klar'; // "Done" on the last step
    return 'Nästa';
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <Box>
        {renderStepContent(activeStep)}
        
        <Box sx={{ display: 'flex', flexDirection: 'row', pt: 4 }}>
          <Button
            color="inherit"
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ mr: 1 }}
            startIcon={<ArrowLeft size={16} />}
          >
            Tillbaka
          </Button>
          
          <Box sx={{ flex: '1 1 auto' }} />
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={isNextDisabled() || isUploading || isSavingMessage}
            endIcon={
              isUploading || isSavingMessage 
                ? <CircularProgress size={16} color="inherit" /> 
                : activeStep === steps.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />
            }
          >
            {getNextButtonText()}
          </Button>
        </Box>
      </Box>
      
      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MulberrySymbols;
export { MulberrySymbols };