"""Technical indicators for DSE stock analysis."""

import pandas as pd


def sma(df: pd.DataFrame, column: str = "Closing_Price", period: int = 20) -> pd.Series:
    """Simple Moving Average."""
    return df[column].rolling(period).mean()


def ema(df: pd.DataFrame, column: str = "Closing_Price", period: int = 20) -> pd.Series:
    """Exponential Moving Average."""
    return df[column].ewm(span=period, adjust=False).mean()


def rsi(df: pd.DataFrame, column: str = "Closing_Price", period: int = 14) -> pd.Series:
    """Relative Strength Index (0-100)."""
    delta = df[column].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()

    rs = avg_gain / avg_loss.replace(0, float("nan"))
    return 100 - (100 / (1 + rs))


def macd(df: pd.DataFrame, column: str = "Closing_Price") -> pd.DataFrame:
    """MACD indicator with Signal and Histogram.

    Returns DataFrame with columns: MACD, Signal, Histogram.
    """
    ema12 = df[column].ewm(span=12, adjust=False).mean()
    ema26 = df[column].ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal_line

    return pd.DataFrame({
        "MACD": macd_line,
        "Signal": signal_line,
        "Histogram": histogram,
    }, index=df.index)


def bollinger_bands(df: pd.DataFrame, column: str = "Closing_Price",
                    period: int = 20, std: int = 2) -> pd.DataFrame:
    """Bollinger Bands.

    Returns DataFrame with columns: Upper, Middle, Lower.
    """
    middle = df[column].rolling(period).mean()
    rolling_std = df[column].rolling(period).std()

    return pd.DataFrame({
        "Upper": middle + std * rolling_std,
        "Middle": middle,
        "Lower": middle - std * rolling_std,
    }, index=df.index)
