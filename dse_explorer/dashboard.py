"""
DSE Stock Analytics Dashboard
Interactive web dashboard for analyzing stock performance.
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from pathlib import Path
from datetime import datetime


# Page config
st.set_page_config(
    page_title="DSE Stock Analytics",
    page_icon="📈",
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
    st.title("📊 DSE Stock Analytics Dashboard")

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

    # Sidebar filters
    st.sidebar.header("🔧 Filters")

    # Company selector
    all_companies = sorted(df['Company'].unique())
    selected_companies = st.sidebar.multiselect(
        "Select Companies",
        options=all_companies,
        default=all_companies[:10]
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

    # Filter metrics
    filtered_metrics = metrics[
        (metrics['Company'].isin(selected_companies)) &
        (metrics['Current_Price'] >= price_range[0]) &
        (metrics['Current_Price'] <= price_range[1])
    ]

    # ===== TOP METRICS ROW =====
    st.markdown("---")
    st.subheader(f"📅 Market Summary ({date_min.strftime('%d %b')} - {date_max.strftime('%d %b %Y')})")

    col1, col2, col3, col4, col5 = st.columns(5)

    gainers = (metrics['Total_Return'] > 0).sum()
    losers = (metrics['Total_Return'] < 0).sum()
    unchanged = (metrics['Total_Return'] == 0).sum()
    avg_return = metrics['Total_Return'].mean()
    total_turnover = metrics['Total_Turnover'].sum()

    col1.metric("Total Stocks", len(metrics))
    col2.metric("Gainers", gainers, f"{gainers/len(metrics)*100:.0f}%")
    col3.metric("Losers", losers, f"-{losers/len(metrics)*100:.0f}%", delta_color="inverse")
    col4.metric("Avg Return", f"{avg_return:.2f}%")
    col5.metric("Total Turnover", f"TZS {total_turnover/1e9:.2f}B")

    # ===== MAIN CHARTS =====
    st.markdown("---")

    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "🏆 Performance", "📈 Price Trends", "💹 Returns Analysis",
        "📊 Volume Analysis", "🎯 Stock Comparison"
    ])

    # TAB 1: Performance Rankings
    with tab1:
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("Top Performers")
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
            st.subheader("Worst Performers")
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

    # ===== DATA TABLE =====
    st.markdown("---")
    st.subheader("📋 Full Metrics Table")

    # Format for display
    display_df = filtered_metrics.copy()
    display_df['Total_Turnover'] = display_df['Total_Turnover'].apply(lambda x: f"TZS {x:,.0f}")
    display_df['Current_Price'] = display_df['Current_Price'].apply(lambda x: f"TZS {x:,.0f}")

    st.dataframe(
        display_df,
        width="stretch",
        height=400
    )

    # Download button
    csv = filtered_metrics.to_csv(index=False)
    st.download_button(
        label="📥 Download Metrics CSV",
        data=csv,
        file_name="stock_metrics.csv",
        mime="text/csv"
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
