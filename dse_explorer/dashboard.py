"""
DSE Stock Analytics Dashboard
Interactive web dashboard for analyzing stock performance.
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from pathlib import Path
from datetime import datetime
from io import BytesIO

from dse_explorer.config import SECTOR_MAP, get_sector


# Page config
st.set_page_config(
    page_title="DSE Stock Analytics",
    page_icon="\U0001F4C8",
    layout="wide",
    initial_sidebar_state="expanded"
)


@st.cache_data
def load_data(csv_path: str = "dse_equity_daily.csv") -> pd.DataFrame:
    """Load and preprocess stock data."""
    df = pd.read_csv(csv_path)
    df['Date'] = pd.to_datetime(df['Date'], format='%Y-%m-%d')
    df = df.sort_values(['Company', 'Date'])
    return df


@st.cache_data
def calculate_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate performance metrics for each stock."""
    metrics = []

    for company in df['Company'].unique():
        stock_data = df[df['Company'] == company].copy()
        stock_data = stock_data.sort_values('Date')

        if len(stock_data) < 1:
            continue

        first_close = stock_data['Closing_Price'].iloc[0]
        last_close = stock_data['Closing_Price'].iloc[-1]

        # Daily returns
        stock_data['Daily_Return'] = stock_data['Closing_Price'].pct_change() * 100

        total_return = ((last_close - first_close) / first_close * 100) if first_close > 0 else 0
        avg_daily_return = stock_data['Daily_Return'].mean()
        volatility = stock_data['Daily_Return'].std()

        total_turnover = stock_data['Turnover'].sum()
        avg_turnover = stock_data['Turnover'].mean()
        trading_days = (stock_data['Turnover'] > 0).sum()
        total_days = len(stock_data)

        period_high = stock_data[stock_data['High'] > 0]['High'].max()
        period_low = stock_data[stock_data['Low'] > 0]['Low'].min()

        latest_return = stock_data['Daily_Return'].iloc[-1] if len(stock_data) > 1 else 0
        sharpe = avg_daily_return / volatility if volatility and volatility > 0 else 0

        metrics.append({
            'Company': company,
            'Current_Price': last_close,
            'Start_Price': first_close,
            'Total_Return': round(total_return, 2) if pd.notna(total_return) else 0,
            'Avg_Daily_Return': round(avg_daily_return, 2) if pd.notna(avg_daily_return) else 0,
            'Volatility': round(volatility, 2) if pd.notna(volatility) else 0,
            'Sharpe_Ratio': round(sharpe, 3) if pd.notna(sharpe) else 0,
            'Total_Turnover': total_turnover,
            'Avg_Turnover': avg_turnover,
            'Trading_Days': trading_days,
            'Total_Days': total_days,
            'Liquidity': round(trading_days / total_days * 100, 1) if total_days > 0 else 0,
            'Period_High': period_high if pd.notna(period_high) else last_close,
            'Period_Low': period_low if pd.notna(period_low) else last_close,
            'Latest_Return': round(latest_return, 2) if pd.notna(latest_return) else 0
        })

    return pd.DataFrame(metrics)


def main():
    # Title
    st.title("\U0001F4CA DSE Stock Analytics Dashboard")

    # Load data
    try:
        df = load_data()
        metrics = calculate_metrics(df)
    except FileNotFoundError:
        st.error("Data file not found. Please run the scraper first.")
        return

    # Date range info
    date_min = df['Date'].min()
    date_max = df['Date'].max()

    # ===== ALERTS DISPLAY =====
    try:
        from dse_explorer.alerts import check_alerts
        triggered = check_alerts(df)
        for alert in triggered:
            st.warning(
                f"Alert: {alert['company']} is {alert['condition']} "
                f"{alert['price']} (current: {alert['current_price']:.2f})"
            )
    except Exception:
        pass

    # Sidebar filters
    st.sidebar.header("\U0001F527 Filters")

    # Watchlist toggle
    watchlist_only = False
    try:
        from dse_explorer.watchlist import load_watchlist
        watchlist = load_watchlist()
        if watchlist:
            watchlist_only = st.sidebar.checkbox(
                f"Show watchlist only ({len(watchlist)} stocks)", value=False
            )
    except Exception:
        watchlist = []

    # Company selector
    all_companies = sorted(df['Company'].unique())
    if watchlist_only and watchlist:
        default_companies = [c for c in watchlist if c in all_companies]
    else:
        default_companies = all_companies[:10]

    selected_companies = st.sidebar.multiselect(
        "Select Companies",
        options=all_companies,
        default=default_companies
    )

    # Price range filter
    price_min = int(metrics['Current_Price'].min())
    price_max = int(metrics['Current_Price'].max())
    price_range = st.sidebar.slider(
        "Price Range (TZS)",
        min_value=price_min,
        max_value=price_max,
        value=(price_min, price_max)
    )

    date_slider = st.sidebar.slider(
        "Date Range",
        min_value=date_min.to_pydatetime(),
        max_value=date_max.to_pydatetime(),
        value=(date_min.to_pydatetime(), date_max.to_pydatetime()),
        format="DD MMM YYYY"
    )

    # Filter metrics
    filtered_metrics = metrics[
        (metrics['Company'].isin(selected_companies)) &
        (metrics['Current_Price'] >= price_range[0]) &
        (metrics['Current_Price'] <= price_range[1])
    ]

    # ===== TOP METRICS ROW =====
    st.markdown("---")
    st.subheader(f"\U0001F4C5 Market Summary ({date_min.strftime('%d %b')} - {date_max.strftime('%d %b %Y')})")

    col1, col2, col3, col4, col5 = st.columns(5)

    gainers = (metrics['Total_Return'] > 0).sum()
    losers = (metrics['Total_Return'] < 0).sum()
    unchanged = (metrics['Total_Return'] == 0).sum()
    avg_return = metrics['Total_Return'].mean()
    total_turnover = metrics['Total_Turnover'].sum()

    col1.metric("Total Stocks", len(metrics))
    col2.metric("Gainers", gainers, f"{gainers/len(metrics)*100:.0f}%")
    col3.metric("Losers", losers, f"-{losers/len(metrics)*100:.0f}%", delta_color="normal")
    col4.metric(f"Avg Return ({date_min.strftime('%d %b')} - {date_max.strftime('%d %b')})", f"{avg_return:.2f}%")
    col5.metric("Total Turnover", f"TZS {total_turnover/1e9:.2f}B")

    # ===== MAIN CHARTS =====
    st.markdown("---")

    # Style tab ribbon: two evenly-spaced rows with grey background
    st.markdown("""
    <style>
    /* Tab list: wrap into rows, grey background */
    div[data-baseweb="tab-list"] {
        flex-wrap: wrap;
        background-color: #f0f2f6;
        border-radius: 8px;
        padding: 6px;
        gap: 6px 4px;
    }
    /* Each tab: equal width (5 per row), centered text */
    div[data-baseweb="tab-list"] button[data-baseweb="tab"] {
        flex: 1 1 18%;
        white-space: nowrap;
        text-align: center;
        justify-content: center;
        border-radius: 6px;
        padding: 8px 4px;
    }
    /* Subtle highlight on the active tab */
    div[data-baseweb="tab-list"] button[aria-selected="true"] {
        background-color: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-radius: 6px;
    }
    /* Hide the default underline highlight bar */
    div[data-baseweb="tab-highlight"] {
        display: none;
    }
    </style>
    """, unsafe_allow_html=True)

    tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8, tab9, tab10 = st.tabs([
        "\U0001F3C6 Performance", "\U0001F4C8 Price Trends", "\U0001F4B9 Returns Analysis",
        "\U0001F4CA Volume Analysis", "\U0001F3AF Stock Comparison",
        "\U0001F4C9 Technical Analysis", "\U0001F9E0 Market Intelligence",
        "\U0001F3ED Sector Analysis", "\U0001F504 Backtesting",
        "\U0001F4DD Analytical Report"
    ])

    # TAB 1: Performance Rankings
    with tab1:
        col1, col2 = st.columns(2)

        with col1:
            st.subheader(f"Top Performers ({date_min.strftime('%d %b')} - {date_max.strftime('%d %b %Y')})")
            top_10 = filtered_metrics.nlargest(10, 'Total_Return')

            fig = px.bar(
                top_10,
                x='Total_Return',
                y='Company',
                orientation='h',
                color='Total_Return',
                color_continuous_scale='Greens',
                labels={'Total_Return': 'Return (%)', 'Company': ''}
            )
            fig.update_layout(height=400, showlegend=False, yaxis={'categoryorder': 'total ascending'})
            st.plotly_chart(fig, width="stretch")

        with col2:
            st.subheader(f"Worst Performers ({date_min.strftime('%d %b')} - {date_max.strftime('%d %b %Y')})")
            bottom_10 = filtered_metrics.nsmallest(10, 'Total_Return')

            fig = px.bar(
                bottom_10,
                x='Total_Return',
                y='Company',
                orientation='h',
                color='Total_Return',
                color_continuous_scale='Reds_r',
                labels={'Total_Return': 'Return (%)', 'Company': ''}
            )
            fig.update_layout(height=400, showlegend=False, yaxis={'categoryorder': 'total descending'})
            st.plotly_chart(fig, width="stretch")

        # Risk-adjusted performance
        st.subheader("Risk-Adjusted Performance (Sharpe Ratio)")
        tradeable = filtered_metrics[filtered_metrics['Volatility'] > 0].nlargest(15, 'Sharpe_Ratio')

        fig = px.bar(
            tradeable,
            x='Company',
            y='Sharpe_Ratio',
            color='Total_Return',
            color_continuous_scale='RdYlGn',
            labels={'Sharpe_Ratio': 'Sharpe Ratio', 'Total_Return': 'Return %'}
        )
        fig.update_layout(height=350)
        st.plotly_chart(fig, width="stretch")

    # TAB 2: Price Trends
    with tab2:
        st.subheader("Stock Price Trends")

        # Stock selector for trend
        trend_stocks = st.multiselect(
            "Select stocks to compare",
            options=all_companies,
            default=all_companies[:5],
            key="trend_stocks"
        )

        if trend_stocks:
            trend_data = df[df['Company'].isin(trend_stocks)]
            trend_data = trend_data[
                (trend_data['Date'] >= pd.Timestamp(date_slider[0])) &
                (trend_data['Date'] <= pd.Timestamp(date_slider[1]))
            ]

            fig = px.line(
                trend_data,
                x='Date',
                y='Closing_Price',
                color='Company',
                labels={'Closing_Price': 'Price (TZS)', 'Date': ''},
                markers=True
            )
            fig.update_layout(height=450, hovermode='x unified')
            st.plotly_chart(fig, width="stretch")

            # Normalized comparison (base 100)
            st.subheader("Normalized Price Comparison (Base = 100)")

            normalized_data = []
            for company in trend_stocks:
                company_data = trend_data[trend_data['Company'] == company].copy()
                if len(company_data) > 0:
                    base_price = company_data['Closing_Price'].iloc[0]
                    company_data['Normalized'] = company_data['Closing_Price'] / base_price * 100
                    normalized_data.append(company_data)

            if normalized_data:
                norm_df = pd.concat(normalized_data)
                fig = px.line(
                    norm_df,
                    x='Date',
                    y='Normalized',
                    color='Company',
                    labels={'Normalized': 'Normalized Price', 'Date': ''},
                    markers=True
                )
                fig.add_hline(y=100, line_dash="dash", line_color="gray", annotation_text="Base")
                fig.update_layout(height=400)
                st.plotly_chart(fig, width="stretch")

    # TAB 3: Returns Analysis
    with tab3:
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("Return Distribution")
            fig = px.histogram(
                filtered_metrics,
                x='Total_Return',
                nbins=20,
                color_discrete_sequence=['#3498db'],
                labels={'Total_Return': 'Return (%)'}
            )
            fig.add_vline(x=0, line_dash="dash", line_color="red")
            fig.update_layout(height=350)
            st.plotly_chart(fig, width="stretch")

        with col2:
            st.subheader("Return vs Volatility")
            fig = px.scatter(
                filtered_metrics[filtered_metrics['Volatility'] > 0],
                x='Volatility',
                y='Total_Return',
                size='Total_Turnover',
                color='Total_Return',
                color_continuous_scale='RdYlGn',
                hover_name='Company',
                labels={'Volatility': 'Volatility (%)', 'Total_Return': 'Return (%)'}
            )
            fig.add_hline(y=0, line_dash="dash", line_color="gray")
            fig.update_layout(height=350)
            st.plotly_chart(fig, width="stretch")

        # Latest day momentum
        st.subheader("Latest Day Momentum")
        momentum = filtered_metrics.nlargest(15, 'Latest_Return')

        colors = ['green' if x > 0 else 'red' for x in momentum['Latest_Return']]
        fig = go.Figure(go.Bar(
            x=momentum['Company'],
            y=momentum['Latest_Return'],
            marker_color=colors,
            text=[f"{x:+.2f}%" for x in momentum['Latest_Return']],
            textposition='outside'
        ))
        fig.update_layout(
            height=350,
            yaxis_title='Return (%)',
            xaxis_title=''
        )
        st.plotly_chart(fig, width="stretch")

    # TAB 4: Volume Analysis
    with tab4:
        st.subheader("Trading Volume by Stock")

        vol_data = filtered_metrics.nlargest(15, 'Total_Turnover')

        fig = px.bar(
            vol_data,
            x='Company',
            y='Total_Turnover',
            color='Total_Return',
            color_continuous_scale='RdYlGn',
            labels={'Total_Turnover': 'Turnover (TZS)', 'Total_Return': 'Return %'}
        )
        fig.update_layout(height=400)
        st.plotly_chart(fig, width="stretch")

        # Volume treemap
        st.subheader("Market Share by Turnover")

        treemap_data = filtered_metrics[filtered_metrics['Total_Turnover'] > 0]
        fig = px.treemap(
            treemap_data,
            path=['Company'],
            values='Total_Turnover',
            color='Total_Return',
            color_continuous_scale='RdYlGn',
            color_continuous_midpoint=0
        )
        fig.update_layout(height=450)
        st.plotly_chart(fig, width="stretch")

        # Volume over time
        st.subheader("Daily Turnover Trend")

        daily_volume = df.groupby('Date')['Turnover'].sum().reset_index()
        daily_volume = daily_volume[
            (daily_volume['Date'] >= pd.Timestamp(date_slider[0])) &
            (daily_volume['Date'] <= pd.Timestamp(date_slider[1]))
        ]

        fig = px.area(
            daily_volume,
            x='Date',
            y='Turnover',
            labels={'Turnover': 'Total Turnover (TZS)', 'Date': ''}
        )
        fig.update_layout(height=300)
        st.plotly_chart(fig, width="stretch")

    # TAB 5: Stock Comparison
    with tab5:
        st.subheader("Compare Two Stocks")

        col1, col2 = st.columns(2)
        with col1:
            stock1 = st.selectbox("Stock 1", all_companies, index=0)
        with col2:
            stock2 = st.selectbox("Stock 2", all_companies, index=1 if len(all_companies) > 1 else 0)

        if stock1 and stock2:
            s1_metrics = metrics[metrics['Company'] == stock1].iloc[0]
            s2_metrics = metrics[metrics['Company'] == stock2].iloc[0]

            comparison_metrics = ['Total_Return', 'Volatility', 'Sharpe_Ratio', 'Liquidity']

            col1, col2, col3, col4 = st.columns(4)

            cols = [col1, col2, col3, col4]
            labels = ['Return %', 'Volatility %', 'Sharpe Ratio', 'Liquidity %']

            for col, metric, label in zip(cols, comparison_metrics, labels):
                v1 = s1_metrics[metric]
                v2 = s2_metrics[metric]
                with col:
                    st.metric(f"{stock1} - {label}", f"{v1:.2f}")
                    st.metric(f"{stock2} - {label}", f"{v2:.2f}")

            # Price comparison chart
            st.subheader("Price Comparison")

            compare_data = df[df['Company'].isin([stock1, stock2])]
            compare_data = compare_data[
                (compare_data['Date'] >= pd.Timestamp(date_slider[0])) &
                (compare_data['Date'] <= pd.Timestamp(date_slider[1]))
            ]

            fig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                               subplot_titles=(f'{stock1} Price', f'{stock2} Price'),
                               vertical_spacing=0.1)

            s1_data = compare_data[compare_data['Company'] == stock1]
            s2_data = compare_data[compare_data['Company'] == stock2]

            fig.add_trace(
                go.Candlestick(
                    x=s1_data['Date'],
                    open=s1_data['Opening_Price'],
                    high=s1_data['High'].where(s1_data['High'] != 0, s1_data['Closing_Price']),
                    low=s1_data['Low'].where(s1_data['Low'] != 0, s1_data['Closing_Price']),
                    close=s1_data['Closing_Price'],
                    name=stock1
                ),
                row=1, col=1
            )

            fig.add_trace(
                go.Candlestick(
                    x=s2_data['Date'],
                    open=s2_data['Opening_Price'],
                    high=s2_data['High'].where(s2_data['High'] != 0, s2_data['Closing_Price']),
                    low=s2_data['Low'].where(s2_data['Low'] != 0, s2_data['Closing_Price']),
                    close=s2_data['Closing_Price'],
                    name=stock2
                ),
                row=2, col=1
            )

            fig.update_layout(height=500, showlegend=False)
            fig.update_xaxes(rangeslider_visible=False)
            st.plotly_chart(fig, width="stretch")

    # TAB 6: Technical Analysis
    with tab6:
        from dse_explorer.indicators import sma, ema, rsi, macd, bollinger_bands

        st.subheader("Technical Analysis")

        ta_stock = st.selectbox("Select Stock", all_companies, key="ta_stock")

        stock_data = df[df['Company'] == ta_stock].copy().sort_values('Date').reset_index(drop=True)
        stock_data = stock_data[
            (stock_data['Date'] >= pd.Timestamp(date_slider[0])) &
            (stock_data['Date'] <= pd.Timestamp(date_slider[1]))
        ].reset_index(drop=True)

        if len(stock_data) < 2:
            st.warning("Not enough data for technical analysis")
        else:
            show_bb = st.checkbox("Show Bollinger Bands", value=False)

            # Candlestick with SMA overlays
            fig = make_subplots(
                rows=3, cols=1, shared_xaxes=True,
                row_heights=[0.5, 0.25, 0.25],
                subplot_titles=(f'{ta_stock} Price', 'RSI', 'MACD'),
                vertical_spacing=0.05
            )

            fig.add_trace(
                go.Candlestick(
                    x=stock_data['Date'],
                    open=stock_data['Opening_Price'],
                    high=stock_data['High'].where(stock_data['High'] != 0, stock_data['Closing_Price']),
                    low=stock_data['Low'].where(stock_data['Low'] != 0, stock_data['Closing_Price']),
                    close=stock_data['Closing_Price'],
                    name=ta_stock
                ),
                row=1, col=1
            )

            # SMA overlays
            sma20 = sma(stock_data, period=20)
            sma50 = sma(stock_data, period=50)

            fig.add_trace(
                go.Scatter(x=stock_data['Date'], y=sma20, name='SMA 20',
                           line=dict(color='orange', width=1)),
                row=1, col=1
            )
            fig.add_trace(
                go.Scatter(x=stock_data['Date'], y=sma50, name='SMA 50',
                           line=dict(color='blue', width=1)),
                row=1, col=1
            )

            # Bollinger Bands
            if show_bb:
                bb = bollinger_bands(stock_data)
                fig.add_trace(
                    go.Scatter(x=stock_data['Date'], y=bb['Upper'], name='BB Upper',
                               line=dict(color='rgba(128,128,128,0.3)'), showlegend=False),
                    row=1, col=1
                )
                fig.add_trace(
                    go.Scatter(x=stock_data['Date'], y=bb['Lower'], name='BB Lower',
                               fill='tonexty', fillcolor='rgba(128,128,128,0.1)',
                               line=dict(color='rgba(128,128,128,0.3)'), showlegend=False),
                    row=1, col=1
                )

            # RSI subplot
            rsi_values = rsi(stock_data)
            fig.add_trace(
                go.Scatter(x=stock_data['Date'], y=rsi_values, name='RSI',
                           line=dict(color='purple', width=1)),
                row=2, col=1
            )
            fig.add_hline(y=70, line_dash="dash", line_color="red", row=2, col=1)
            fig.add_hline(y=30, line_dash="dash", line_color="green", row=2, col=1)

            # MACD subplot
            macd_data = macd(stock_data)
            fig.add_trace(
                go.Scatter(x=stock_data['Date'], y=macd_data['MACD'], name='MACD',
                           line=dict(color='blue', width=1)),
                row=3, col=1
            )
            fig.add_trace(
                go.Scatter(x=stock_data['Date'], y=macd_data['Signal'], name='Signal',
                           line=dict(color='orange', width=1)),
                row=3, col=1
            )
            histogram_colors = ['green' if v >= 0 else 'red' for v in macd_data['Histogram']]
            fig.add_trace(
                go.Bar(x=stock_data['Date'], y=macd_data['Histogram'], name='Histogram',
                       marker_color=histogram_colors, showlegend=False),
                row=3, col=1
            )

            fig.update_layout(height=700, xaxis3_rangeslider_visible=False)
            fig.update_xaxes(rangeslider_visible=False)
            st.plotly_chart(fig, width="stretch")

    # TAB 7: Market Intelligence
    with tab7:
        from dse_explorer.analyzer import StockAnalyzer

        st.subheader("Market Intelligence")

        analyzer = StockAnalyzer()
        analyzer.load_data()

        # Order Book Analysis
        st.markdown("### Order Book Analysis")
        order_book = analyzer.analyze_order_book(metrics)

        # Color code pressure
        def _pressure_color(p):
            if p == "Strong Buy Pressure":
                return "background-color: rgba(0,200,0,0.2)"
            elif p == "Sell Pressure":
                return "background-color: rgba(200,0,0,0.2)"
            return ""

        ob_display = order_book.copy()
        st.dataframe(ob_display, width="stretch", height=300)

        # Bid/Offer ratio bar chart
        ob_chart = order_book[order_book['Bid_Offer_Ratio'].notna()].copy()
        if not ob_chart.empty:
            fig = px.bar(
                ob_chart, x='Company', y='Bid_Offer_Ratio', color='Pressure',
                color_discrete_map={
                    "Strong Buy Pressure": "green",
                    "Neutral": "gray",
                    "Sell Pressure": "red"
                },
                labels={'Bid_Offer_Ratio': 'Bid/Offer Ratio'}
            )
            fig.add_hline(y=1, line_dash="dash", line_color="gray")
            fig.update_layout(height=350)
            st.plotly_chart(fig, width="stretch")

        # Volume Spike Alerts
        st.markdown("### Volume Spike Alerts")
        vol_spikes = analyzer.detect_volume_spikes()
        if not vol_spikes.empty:
            st.dataframe(vol_spikes, width="stretch")
        else:
            st.info("No volume spikes detected (threshold: 2x average)")

        # Market Breadth
        st.markdown("### Market Breadth")
        breadth = analyzer.market_breadth()

        b_col1, b_col2, b_col3 = st.columns(3)
        b_col1.metric("Advance / Decline Ratio",
                       breadth['advance_decline_ratio'] if breadth['advance_decline_ratio'] is not None else "N/A")
        b_col2.metric("% Positive Return", f"{breadth['pct_positive_return']:.1f}%")
        b_col3.metric("% Above Period Avg", f"{breadth['pct_above_avg_price']:.1f}%")

        # Correlation Heatmap
        st.markdown("### Price Correlation Matrix")
        corr = analyzer.correlation_matrix()
        # Filter to selected companies
        sel_corr = corr.loc[
            corr.index.isin(selected_companies),
            corr.columns.isin(selected_companies)
        ]
        # Drop stocks with no correlation data (e.g. no trades)
        valid = sel_corr.dropna(how="all").dropna(axis=1, how="all")
        if not valid.empty:
            # Lower triangular mask (hide upper triangle and diagonal)
            mask = np.triu(np.ones_like(valid, dtype=bool))
            lower = valid.where(~mask)
            fig = px.imshow(
                lower,
                color_continuous_scale='RdBu_r',
                zmin=-1, zmax=1,
                labels=dict(color="Correlation"),
            )
            fig.update_layout(height=500)
            st.plotly_chart(fig, width="stretch")

    # TAB 8: Sector Analysis
    with tab8:
        st.subheader("Sector Analysis")

        # Add sector column to metrics
        sector_metrics = metrics.copy()
        sector_metrics['Sector'] = sector_metrics['Company'].apply(get_sector)

        # Sector performance bar chart
        sector_perf = sector_metrics.groupby('Sector').agg(
            Avg_Return=('Total_Return', 'mean'),
            Num_Stocks=('Company', 'count'),
            Total_Turnover=('Total_Turnover', 'sum')
        ).reset_index().sort_values('Avg_Return', ascending=False)

        st.markdown("### Sector Performance (Average Return)")
        fig = px.bar(
            sector_perf, x='Sector', y='Avg_Return',
            color='Avg_Return', color_continuous_scale='RdYlGn',
            labels={'Avg_Return': 'Avg Return (%)'}
        )
        fig.update_layout(height=350)
        st.plotly_chart(fig, width="stretch")

        # Sector treemap by turnover
        st.markdown("### Sector Market Share (by Turnover)")
        treemap_sector = sector_metrics[sector_metrics['Total_Turnover'] > 0]
        fig = px.treemap(
            treemap_sector,
            path=['Sector', 'Company'],
            values='Total_Turnover',
            color='Total_Return',
            color_continuous_scale='RdYlGn',
            color_continuous_midpoint=0
        )
        fig.update_layout(height=500)
        st.plotly_chart(fig, width="stretch")

        # Sector comparison table
        st.markdown("### Sector Comparison")
        st.dataframe(sector_perf, width="stretch")

    # TAB 9: Backtesting
    with tab9:
        from dse_explorer.backtest import MomentumBacktest

        st.subheader("Momentum Backtesting")

        top_n = st.slider("Number of top stocks to hold", min_value=1, max_value=15, value=5)

        if st.button("Run Backtest"):
            with st.spinner("Running backtest..."):
                bt = MomentumBacktest(top_n=top_n)
                try:
                    results = bt.run()
                except Exception as e:
                    st.error(f"Backtest failed: {e}")
                    results = None

            if results:
                st.markdown("### Results")
                r_col1, r_col2, r_col3, r_col4 = st.columns(4)
                r_col1.metric("Total Return", f"{results['total_return_pct']:+.2f}%")
                r_col2.metric("Win Rate", f"{results['win_rate_pct']:.1f}%")
                r_col3.metric("Max Drawdown", f"{results['max_drawdown_pct']:.2f}%")
                r_col4.metric("Trading Days", results['trading_days'])

                col_a, col_b = st.columns(2)
                col_a.metric("Best Day", f"{results['best_day_pct']:+.2f}%")
                col_b.metric("Worst Day", f"{results['worst_day_pct']:+.2f}%")

                # Latest holdings
                if bt.daily_holdings:
                    latest = bt.daily_holdings[-1]
                    st.markdown(f"### Stocks to Hold ({latest['Date'].strftime('%Y-%m-%d')})")
                    holdings_rows = []
                    for d in latest["Details"]:
                        holdings_rows.append({
                            "Stock": d["Stock"],
                            "Weight": f"{100 / len(latest['Details']):.1f}%",
                            "Prev Day Return": f"{d['Prev_Return_Pct']:+.2f}%",
                            "Day Return": f"{d['Day_Return_Pct']:+.2f}%" if d["Day_Return_Pct"] is not None else "N/A",
                        })
                    st.dataframe(pd.DataFrame(holdings_rows), hide_index=True, width="stretch")

                # Holdings history
                if bt.daily_holdings:
                    st.markdown("### Daily Holdings History")
                    history_rows = []
                    for entry in bt.daily_holdings:
                        history_rows.append({
                            "Date": entry["Date"].strftime("%Y-%m-%d"),
                            "Stocks Held": ", ".join(entry["Stocks"]),
                            "Portfolio Return": f"{entry['Portfolio_Return_Pct']:+.2f}%",
                        })
                    hist_df = pd.DataFrame(history_rows)
                    st.dataframe(hist_df, hide_index=True, height=300, width="stretch")

                # Portfolio value chart
                if bt.portfolio_values:
                    pv_df = pd.DataFrame(bt.portfolio_values)
                    pv_df = pv_df[
                        (pv_df['Date'] >= pd.Timestamp(date_slider[0])) &
                        (pv_df['Date'] <= pd.Timestamp(date_slider[1]))
                    ]

                    fig = px.line(
                        pv_df, x='Date', y='Value',
                        labels={'Value': 'Portfolio Value', 'Date': ''},
                        title=f"Portfolio Value (Top {top_n} Momentum Strategy)"
                    )
                    fig.add_hline(y=100, line_dash="dash", line_color="gray",
                                  annotation_text="Starting Value")
                    fig.update_layout(height=400)
                    st.plotly_chart(fig, width="stretch")

    # ===== DATA TABLE =====
    st.markdown("---")
    st.subheader("\U0001F4CB Full Metrics Table")

    # Format for display
    display_df = filtered_metrics.copy()
    display_df['Total_Turnover'] = display_df['Total_Turnover'].apply(lambda x: f"TZS {x:,.0f}")
    display_df['Current_Price'] = display_df['Current_Price'].apply(lambda x: f"TZS {x:,.0f}")

    st.dataframe(
        display_df,
        width="stretch",
        height=400
    )

    # Download buttons
    dl_col1, dl_col2 = st.columns(2)

    with dl_col1:
        csv = filtered_metrics.to_csv(index=False)
        st.download_button(
            label="\U0001F4E5 Download Metrics CSV",
            data=csv,
            file_name="stock_metrics.csv",
            mime="text/csv"
        )

    with dl_col2:
        if st.button("\U0001F4E5 Generate Excel Report"):
            with st.spinner("Generating Excel report..."):
                try:
                    from dse_explorer.analyzer import StockAnalyzer as SA
                    a = SA()
                    a.load_data()

                    buf = BytesIO()
                    a.export_excel(output_path=buf)
                    buf.seek(0)
                    st.download_button(
                        label="\U0001F4E5 Download Excel Report",
                        data=buf,
                        file_name="dse_report.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        key="download_excel"
                    )
                except ImportError:
                    st.error("openpyxl is required for Excel export. Install it with: pip install openpyxl")

    # TAB 10: Analytical Report
    with tab10:
        st.subheader("Analytical Report")
        if st.button("Generate Report"):
            from dse_explorer.analyzer import StockAnalyzer
            with st.spinner("Generating report..."):
                a = StockAnalyzer()
                a.load_data()
                report_text = a.generate_report(output_path="report.txt")
                m = a.calculate_metrics()

            rpt_date_min = a.df['Date'].min().strftime('%d-%b-%Y')
            rpt_date_max = a.df['Date'].max().strftime('%d-%b-%Y')
            rpt_days = a.df['Date'].nunique()

            st.markdown(f"**Generated:** {a.analysis_date}  ")
            st.markdown(f"**Data Period:** {rpt_date_min} to {rpt_date_max} ({rpt_days} trading days)  ")
            st.markdown(f"**Total Stocks Analyzed:** {len(m)}")

            # Market Overview
            gainers_r = (m['Total_Return_Pct'] > 0).sum()
            losers_r = (m['Total_Return_Pct'] < 0).sum()
            unchanged_r = (m['Total_Return_Pct'] == 0).sum()
            st.markdown(f"## Market Overview ({rpt_date_min} to {rpt_date_max})")
            ov_col1, ov_col2, ov_col3, ov_col4 = st.columns(4)
            ov_col1.metric("Gainers", f"{gainers_r}")
            ov_col2.metric("Losers", f"{losers_r}")
            ov_col3.metric("Unchanged", f"{unchanged_r}")
            ov_col4.metric("Avg Return", f"{m['Total_Return_Pct'].mean():.2f}%")

            # Top Performers
            st.markdown("## Top 10 Best Performers")
            top_ret = a.get_top_performers(m, 'Total_Return_Pct', 10)
            st.dataframe(
                top_ret[['Company', 'Total_Return_Pct', 'Current_Price', 'Volatility_Pct', 'Total_Turnover']].rename(
                    columns={'Total_Return_Pct': 'Return %', 'Current_Price': 'Price (TZS)',
                             'Volatility_Pct': 'Volatility %', 'Total_Turnover': 'Turnover (TZS)'}),
                hide_index=True, width="stretch"
            )

            # Worst Performers
            st.markdown("## Top 10 Worst Performers")
            worst_ret = a.get_top_performers(m, 'Total_Return_Pct', 10, ascending=True)
            st.dataframe(
                worst_ret[['Company', 'Total_Return_Pct', 'Current_Price', 'Volatility_Pct', 'Total_Turnover']].rename(
                    columns={'Total_Return_Pct': 'Return %', 'Current_Price': 'Price (TZS)',
                             'Volatility_Pct': 'Volatility %', 'Total_Turnover': 'Turnover (TZS)'}),
                hide_index=True, width="stretch"
            )

            # Most Actively Traded
            st.markdown("## Top 10 Most Actively Traded")
            top_turn = a.get_top_performers(m, 'Total_Turnover', 10)
            st.dataframe(
                top_turn[['Company', 'Total_Turnover', 'Total_Return_Pct', 'Liquidity_Ratio']].rename(
                    columns={'Total_Turnover': 'Turnover (TZS)', 'Total_Return_Pct': 'Return %',
                             'Liquidity_Ratio': 'Liquidity %'}),
                hide_index=True, width="stretch"
            )

            # Risk-Adjusted (Sharpe)
            st.markdown("## Top 10 Risk-Adjusted Performers (Sharpe Ratio)")
            tradeable_r = m[m['Volatility_Pct'] > 0]
            top_sharpe = a.get_top_performers(tradeable_r, 'Sharpe_Ratio', 10)
            st.dataframe(
                top_sharpe[['Company', 'Sharpe_Ratio', 'Total_Return_Pct', 'Volatility_Pct', 'Current_Price']].rename(
                    columns={'Sharpe_Ratio': 'Sharpe', 'Total_Return_Pct': 'Return %',
                             'Volatility_Pct': 'Volatility %', 'Current_Price': 'Price (TZS)'}),
                hide_index=True, width="stretch"
            )

            # Most Volatile
            st.markdown("## Top 10 Most Volatile Stocks")
            top_vol = a.get_top_performers(m, 'Volatility_Pct', 10)
            st.dataframe(
                top_vol[['Company', 'Volatility_Pct', 'Total_Return_Pct', 'Price_Range_Pct']].rename(
                    columns={'Volatility_Pct': 'Volatility %', 'Total_Return_Pct': 'Return %',
                             'Price_Range_Pct': 'Price Range %'}),
                hide_index=True, width="stretch"
            )

            # Latest Day Momentum
            st.markdown("## Latest Day Momentum")
            top_mom = a.get_top_performers(m, 'Latest_Return_Pct', 10)
            st.dataframe(
                top_mom[['Company', 'Latest_Return_Pct', 'Current_Price', 'Total_Return_Pct']].rename(
                    columns={'Latest_Return_Pct': 'Today %', 'Current_Price': 'Price (TZS)',
                             'Total_Return_Pct': 'Total Return %'}),
                hide_index=True, width="stretch"
            )

            # Order Book Analysis
            st.markdown("## Order Book Analysis")
            order_book = a.analyze_order_book(m)
            st.dataframe(
                order_book[['Company', 'Outstanding_Bids', 'Outstanding_Offers', 'Bid_Offer_Ratio', 'Pressure']].rename(
                    columns={'Outstanding_Bids': 'Bids', 'Outstanding_Offers': 'Offers',
                             'Bid_Offer_Ratio': 'Ratio'}),
                hide_index=True, width="stretch"
            )

            # Volume Spikes
            vol_spikes = a.detect_volume_spikes()
            if not vol_spikes.empty:
                st.markdown("## Volume Spike Alerts (>= 2x Average)")
                st.dataframe(
                    vol_spikes[['Company', 'Latest_Volume', 'Avg_Volume', 'Spike_Ratio']].rename(
                        columns={'Latest_Volume': 'Latest Volume', 'Avg_Volume': 'Avg Volume',
                                 'Spike_Ratio': 'Spike Ratio'}),
                    hide_index=True, width="stretch"
                )

            # Market Breadth
            breadth_r = a.market_breadth()
            st.markdown("## Market Breadth")
            br_col1, br_col2, br_col3 = st.columns(3)
            br_col1.metric("Advancing", breadth_r['gainers'])
            br_col2.metric("Declining", breadth_r['losers'])
            ad_r = breadth_r['advance_decline_ratio']
            br_col3.metric("A/D Ratio", ad_r if ad_r is not None else "N/A")

            # Sector Performance
            st.markdown("## Sector Performance")
            sector_perf_r = a.sector_performance()
            st.dataframe(
                sector_perf_r.rename(columns={
                    'Avg_Return': 'Avg Return %', 'Num_Stocks': 'Stocks',
                    'Total_Turnover': 'Total Turnover (TZS)'}),
                hide_index=True, width="stretch"
            )

            # Investment Insights (narrative)
            st.markdown("## Investment Insights")
            strong = m[
                (m['Total_Return_Pct'] > 0) &
                (m['Liquidity_Ratio'] >= 100) &
                (m['Volatility_Pct'] > 0)
            ].nlargest(5, 'Sharpe_Ratio')
            if len(strong) > 0:
                st.markdown("**Strong Performers** (Good returns with high liquidity):")
                for _, row in strong.iterrows():
                    st.markdown(
                        f"- **{row['Company']}**: Return {row['Total_Return_Pct']:+.2f}%, "
                        f"Sharpe {row['Sharpe_Ratio']:.3f}, "
                        f"Turnover TZS {row['Total_Turnover']:,.0f}"
                    )

            hot = m[m['Latest_Return_Pct'] > 2].nlargest(3, 'Latest_Return_Pct')
            if len(hot) > 0:
                st.markdown("**High Momentum** (Latest day gains > 2%):")
                for _, row in hot.iterrows():
                    st.markdown(f"- **{row['Company']}**: +{row['Latest_Return_Pct']:.2f}% today")

            value = m[
                (m['Total_Return_Pct'] < -5) &
                (m['Liquidity_Ratio'] >= 100)
            ].nsmallest(3, 'Total_Return_Pct')
            if len(value) > 0:
                st.markdown("**Potential Value Plays** (Oversold but liquid):")
                for _, row in value.iterrows():
                    st.markdown(
                        f"- **{row['Company']}**: {row['Total_Return_Pct']:.2f}% "
                        f"(Price: TZS {row['Current_Price']:,.0f})"
                    )

            st.markdown("---")
            st.caption("*DISCLAIMER: This report is for informational purposes only. "
                       "Past performance does not guarantee future results.*")

            st.download_button(
                label="\U0001F4E5 Download Report",
                data=report_text,
                file_name="dse_analysis_report.txt",
                mime="text/plain",
                key="download_report"
            )

    # Footer
    st.markdown("---")
    st.caption(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Data source: DSE Tanzania")


def cli():
    """CLI entry point: update data then launch streamlit."""
    import sys
    from streamlit.web.cli import main as st_main

    print("Updating market data before launching dashboard...")
    try:
        from dse_explorer.pipeline import main as run_pipeline
        run_pipeline()
    except Exception as e:
        print(f"Data update failed ({e}), launching dashboard with existing data.")

    sys.argv = ["streamlit", "run", __file__]
    st_main()


if __name__ == "__main__":
    main()
